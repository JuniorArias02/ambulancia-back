import { Injectable } from '@nestjs/common';
import { PublicadorEventos } from '../../../../common/events/publicador_eventos.js';
import {
  ConflictoNegocioError,
  RecursoNoEncontradoError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import { Turno } from '../../domain/entities/turno.entity.js';
import { TurnosRepositorio } from '../../domain/repositories/turnos.repository.js';

const MOTIVO_TRIPULACION_INCOMPLETA = 'Tripulación incompleta desde la app';

interface Salida {
  turnoCerrado: Turno;
  turnoSiguiente: Turno | null;
  deshabilitada: boolean;
}

/**
 * Quien sale deja el turno cerrado con la tripulación que tenía, para no perder
 * quién atendió cada servicio; los que se quedan siguen en un turno nuevo.
 * Salir sin estar en ninguna ambulancia no es un error: un reintento no cambia nada.
 */
@Injectable()
export class SalirDeAmbulancia {
  constructor(
    private readonly turnosRepositorio: TurnosRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
    private readonly eventos: PublicadorEventos,
  ) {}

  async ejecutar(contexto: ContextoSolicitud): Promise<void> {
    const usuarioId = contexto.usuarioId;
    if (!usuarioId) return;
    const leido = await this.turnosRepositorio.buscarActivoDeUsuario(usuarioId);
    if (!leido) return;
    const ambulanciaId = leido.ambulanciaId;

    const salida = await this.turnosRepositorio.enExclusiva<Salida | null>(
      { usuarioId, ambulanciaId },
      async (operaciones) => {
        const turno = await operaciones.buscarTurnoActivoDeUsuario(usuarioId);
        if (!turno) return null;
        if (turno.ambulanciaId !== ambulanciaId) {
          throw new ConflictoNegocioError(
            'Su ambulancia cambió mientras tanto; vuelva a consultarla',
          );
        }
        const ambulancia = await operaciones.buscarAmbulancia(ambulanciaId);
        if (!ambulancia) throw new RecursoNoEncontradoError('Ambulancia');
        if (ambulancia.estadoOperativo === 'en_servicio') {
          throw new ReglaNegocioError(
            'La ambulancia está atendiendo un servicio; finalícelo antes de salir',
          );
        }

        const ahora = new Date();
        const quedan = turno.integrantes
          .filter((i) => i.usuarioId !== usuarioId)
          .map((i) => ({ usuarioId: i.usuarioId, funcion: i.funcion }));
        turno.finalizar(ahora);
        const turnoCerrado = await operaciones.finalizarTurno(turno);
        const turnoSiguiente =
          quedan.length > 0
            ? await operaciones.crearTurno(
                Turno.iniciar({
                  ambulanciaId,
                  integrantes: quedan,
                  inicio: ahora,
                }),
              )
            : null;

        const deshabilitada =
          ambulancia.estaDisponible() &&
          !turnoSiguiente?.tieneTripulacionCompleta();
        if (deshabilitada) {
          ambulancia.cambiarEstadoManual('fuera_servicio');
          await operaciones.cambiarEstadoAmbulancia(ambulancia, {
            id: crypto.randomUUID(),
            ambulanciaId,
            estadoAnterior: 'disponible',
            estadoNuevo: 'fuera_servicio',
            motivo: MOTIVO_TRIPULACION_INCOMPLETA,
            usuarioId,
            cambiadoEn: ahora,
          });
        }
        return { turnoCerrado, turnoSiguiente, deshabilitada };
      },
    );
    if (salida) await this.informar(salida, ambulanciaId, usuarioId, contexto);
  }

  private async informar(
    { turnoCerrado, turnoSiguiente, deshabilitada }: Salida,
    ambulanciaId: string,
    usuarioId: string,
    contexto: ContextoSolicitud,
  ): Promise<void> {
    await this.auditoria.registrar({
      usuarioId,
      entidad: 'turnos',
      entidadId: turnoCerrado.id,
      accion: 'salir_ambulancia',
      detalle: {
        ambulanciaId,
        funcion: turnoCerrado.funcionDe(usuarioId),
        turnoSiguienteId: turnoSiguiente?.id ?? null,
      },
      direccionIp: contexto.direccionIp,
    });
    if (deshabilitada) {
      await this.auditoria.registrar({
        usuarioId,
        entidad: 'ambulancias',
        entidadId: ambulanciaId,
        accion: 'cambiar_estado',
        detalle: {
          estadoAnterior: 'disponible',
          estadoNuevo: 'fuera_servicio',
          origen: 'tripulacion',
        },
        direccionIp: contexto.direccionIp,
      });
    }

    this.eventos.publicar({
      tipo: 'turno.actualizado',
      turnoId: turnoCerrado.id,
      usuariosAfectados: [usuarioId],
    });
    if (turnoSiguiente) {
      this.eventos.publicar({
        tipo: 'turno.actualizado',
        turnoId: turnoSiguiente.id,
        usuariosAfectados: turnoSiguiente.integrantes.map((i) => i.usuarioId),
      });
    }
    if (deshabilitada) {
      this.eventos.publicar({ tipo: 'ambulancia.actualizada', ambulanciaId });
    }
  }
}
