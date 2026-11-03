import { Injectable } from '@nestjs/common';
import { PublicadorEventos } from '../../../../common/events/publicador_eventos.js';
import {
  AccesoDenegadoError,
  ConflictoNegocioError,
  RecursoNoEncontradoError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type { Ambulancia } from '../../domain/entities/ambulancia.entity.js';
import {
  type MotivoDeLaAmbulancia,
  motivoNoSeleccionable,
} from '../../domain/entities/seleccion_ambulancia.js';
import {
  type NuevoIntegrante,
  Turno,
} from '../../domain/entities/turno.entity.js';
import {
  type OperacionesTripulacion,
  TurnosRepositorio,
} from '../../domain/repositories/turnos.repository.js';

const MOTIVO_TRIPULACION_COMPLETA = 'Tripulación completa desde la app';

const MENSAJES: Record<MotivoDeLaAmbulancia, string> = {
  en_servicio: 'La ambulancia está atendiendo un servicio',
  mantenimiento: 'La ambulancia está en mantenimiento',
  conductor_ocupado: 'La ambulancia ya tiene conductor',
  tripulacion_llena: 'La tripulación de la ambulancia ya está completa',
};

interface Seleccion {
  turno: Turno;
  /** Turno anterior cerrado porque ya tenía servicios. */
  turnoCerrado: Turno | null;
  habilitada: boolean;
  /** `false` si ya estaba en esta ambulancia: un reintento no cambia nada. */
  ingreso: boolean;
}

/**
 * El conductor o el paramédico se sube a la ambulancia: sale del token quién es
 * y, de su rol, qué función cumple. Al completarse la tripulación, queda disponible.
 */
@Injectable()
export class SeleccionarAmbulancia {
  constructor(
    private readonly turnosRepositorio: TurnosRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
    private readonly eventos: PublicadorEventos,
  ) {}

  async ejecutar(
    ambulanciaId: string,
    contexto: ContextoSolicitud,
  ): Promise<Turno> {
    const usuarioId = contexto.usuarioId;
    const funcion = contexto.rol ? Turno.funcionDelRol(contexto.rol) : null;
    if (!usuarioId || !funcion) {
      throw new AccesoDenegadoError(
        'Solo un conductor o un paramédico puede seleccionar una ambulancia',
      );
    }
    const nuevo: NuevoIntegrante = { usuarioId, funcion };

    const seleccion = await this.turnosRepositorio.enExclusiva(
      { usuarioId, ambulanciaId },
      async (operaciones) => {
        const propio = await operaciones.buscarTurnoActivoDeUsuario(usuarioId);
        if (propio) {
          if (propio.ambulanciaId !== ambulanciaId) {
            throw new ConflictoNegocioError(
              `Ya está en la ambulancia ${propio.ambulanciaCodigo}; salga de ella antes de elegir otra`,
            );
          }
          return {
            turno: propio,
            turnoCerrado: null,
            habilitada: false,
            ingreso: false,
          };
        }

        const ambulancia = await operaciones.buscarAmbulancia(ambulanciaId);
        if (!ambulancia) throw new RecursoNoEncontradoError('Ambulancia');
        const actual =
          await operaciones.buscarTurnoActivoDeAmbulancia(ambulanciaId);
        this.exigirCupo(ambulancia, actual, nuevo);

        const estabaCompleta = actual?.tieneTripulacionCompleta() ?? false;
        const { turno, turnoCerrado } = await this.incorporar(
          operaciones,
          actual,
          nuevo,
          ambulanciaId,
        );

        // Solo cuando esta persona la completa: si la central la sacó de
        // servicio con la tripulación completa, un tercero no la reactiva.
        const habilitada =
          !estabaCompleta &&
          turno.tieneTripulacionCompleta() &&
          ambulancia.estadoOperativo === 'fuera_servicio';
        if (habilitada) {
          ambulancia.cambiarEstadoManual('disponible');
          await operaciones.cambiarEstadoAmbulancia(ambulancia, {
            id: crypto.randomUUID(),
            ambulanciaId,
            estadoAnterior: 'fuera_servicio',
            estadoNuevo: 'disponible',
            motivo: MOTIVO_TRIPULACION_COMPLETA,
            usuarioId,
            cambiadoEn: new Date(),
          });
        }
        return { turno, turnoCerrado, habilitada, ingreso: true };
      },
    );

    if (seleccion.ingreso) {
      await this.informar(seleccion, nuevo, ambulanciaId, contexto);
    }
    return seleccion.turno;
  }

  private exigirCupo(
    ambulancia: Ambulancia,
    turno: Turno | null,
    { funcion }: NuevoIntegrante,
  ): void {
    const motivo = motivoNoSeleccionable(ambulancia, turno, funcion);
    if (!motivo) return;
    if (motivo === 'mantenimiento') {
      throw new ReglaNegocioError(MENSAJES[motivo]);
    }
    throw new ConflictoNegocioError(MENSAJES[motivo]);
  }

  /**
   * Un turno con servicios conserva su tripulación: se cierra y sigue en uno nuevo.
   * Así quien llega no entra a la historia clínica de servicios que no atendió.
   */
  private async incorporar(
    operaciones: OperacionesTripulacion,
    actual: Turno | null,
    nuevo: NuevoIntegrante,
    ambulanciaId: string,
  ): Promise<Pick<Seleccion, 'turno' | 'turnoCerrado'>> {
    const ahora = new Date();
    if (!actual) {
      const turno = await operaciones.crearTurno(
        Turno.iniciar({ ambulanciaId, integrantes: [nuevo], inicio: ahora }),
      );
      return { turno, turnoCerrado: null };
    }

    if (!(await operaciones.tieneServicios(actual.id))) {
      actual.agregarIntegrante(nuevo);
      const turno = await operaciones.agregarIntegrante(actual.id, nuevo);
      return { turno, turnoCerrado: null };
    }

    const integrantes: NuevoIntegrante[] = [
      ...actual.integrantes.map(({ usuarioId, funcion }) => ({
        usuarioId,
        funcion,
      })),
      nuevo,
    ];
    actual.finalizar(ahora);
    const turnoCerrado = await operaciones.finalizarTurno(actual);
    const turno = await operaciones.crearTurno(
      Turno.iniciar({ ambulanciaId, integrantes, inicio: ahora }),
    );
    return { turno, turnoCerrado };
  }

  private async informar(
    { turno, turnoCerrado, habilitada }: Seleccion,
    { usuarioId, funcion }: NuevoIntegrante,
    ambulanciaId: string,
    contexto: ContextoSolicitud,
  ): Promise<void> {
    await this.auditoria.registrar({
      usuarioId,
      entidad: 'turnos',
      entidadId: turno.id,
      accion: 'seleccionar_ambulancia',
      detalle: {
        ambulanciaId,
        funcion,
        turnoAnteriorId: turnoCerrado?.id ?? null,
      },
      direccionIp: contexto.direccionIp,
    });
    if (habilitada) {
      await this.auditoria.registrar({
        usuarioId,
        entidad: 'ambulancias',
        entidadId: ambulanciaId,
        accion: 'cambiar_estado',
        detalle: {
          estadoAnterior: 'fuera_servicio',
          estadoNuevo: 'disponible',
          origen: 'tripulacion',
        },
        direccionIp: contexto.direccionIp,
      });
    }

    const usuariosAfectados = turno.integrantes.map((i) => i.usuarioId);
    if (turnoCerrado) {
      this.eventos.publicar({
        tipo: 'turno.actualizado',
        turnoId: turnoCerrado.id,
        usuariosAfectados: [],
      });
    }
    this.eventos.publicar({
      tipo: 'turno.actualizado',
      turnoId: turno.id,
      usuariosAfectados,
    });
    if (habilitada) {
      this.eventos.publicar({ tipo: 'ambulancia.actualizada', ambulanciaId });
    }
  }
}
