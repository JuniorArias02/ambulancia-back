import { Injectable } from '@nestjs/common';
import type { NombreRol } from '../../../../common/constants/roles.js';
import {
  ConflictoNegocioError,
  RecursoNoEncontradoError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import { PublicadorEventos } from '../../../../common/events/publicador_eventos.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import type { PuntoGeografico } from '../../../../common/utils/geografia.js';
import { AmbulanciasRepositorio } from '../../../ambulances/domain/repositories/ambulancias.repository.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type { Emergencia } from '../../../emergencies/domain/entities/emergencia.entity.js';
import { EmergenciasRepositorio } from '../../../emergencies/domain/repositories/emergencias.repository.js';
import type {
  Asignacion,
  EstadoAvance,
} from '../../domain/entities/asignacion.entity.js';
import { crearEventoAsignacion } from '../../domain/entities/evento_asignacion.entity.js';
import {
  AsignacionesRepositorio,
  type CambioAmbulancia,
  type CambioEmergencia,
} from '../../domain/repositories/asignaciones.repository.js';
import {
  type VerificacionLlegada,
  verificarLlegada,
} from '../../domain/services/verificacion_llegada.js';
import { ConfiguracionAsignaciones } from '../configuracion_asignaciones.js';
import { PermisoServicio } from '../services/permiso_servicio.service.js';

export interface AvanzarAsignacionEntrada {
  asignacionId: string;
  estado: EstadoAvance;
  /** Rol de quien marca el paso: queda como responsable en el evento. */
  rolSolicitante: NombreRol;
  /** GPS del celular al marcar el paso; obligatorio para confirmar la llegada. */
  posicion?: PuntoGeografico;
  precisionMetros?: number;
  /** Obligatoria al cerrar sin traslado y al confirmar la llegada fuera del radio. */
  observacion?: string;
  /** El conductor insiste en que llegó aunque el GPS lo ubique fuera del radio. */
  confirmarFueraDeRadio?: boolean;
}

/**
 * Registra un paso del ciclo de atención (desplazamiento, llegada, atención,
 * traslado, cierre) con su responsable, hora y posición, y sus efectos sobre
 * la emergencia y la ambulancia, todo en una sola transacción.
 *
 * Repetir un paso que ya está hecho (doble toque, reintento sin señal) no es
 * un error: devuelve el servicio tal como está, sin registrar nada nuevo.
 */
@Injectable()
export class AvanzarAsignacion {
  constructor(
    private readonly asignacionesRepositorio: AsignacionesRepositorio,
    private readonly emergenciasRepositorio: EmergenciasRepositorio,
    private readonly ambulanciasRepositorio: AmbulanciasRepositorio,
    private readonly permisos: PermisoServicio,
    private readonly configuracion: ConfiguracionAsignaciones,
    private readonly auditoria: AuditoriaRepositorio,
    private readonly eventos: PublicadorEventos,
  ) {}

  async ejecutar(
    datos: AvanzarAsignacionEntrada,
    contexto: ContextoSolicitud,
  ): Promise<Asignacion> {
    const asignacion = await this.buscarAsignacion(datos.asignacionId);
    const solicitante = {
      usuarioId: contexto.usuarioId,
      rol: datos.rolSolicitante,
    };
    if (datos.estado === 'en_escena') {
      await this.permisos.exigirConductor(asignacion, solicitante);
    } else {
      await this.permisos.exigirCentralOTripulacion(asignacion, solicitante);
    }

    if (asignacion.estado === datos.estado) return asignacion;

    const observacion = datos.observacion?.trim() || null;
    if (asignacion.cierreRequiereMotivo(datos.estado) && !observacion) {
      throw new ReglaNegocioError(
        'Indique por qué se cierra el servicio sin trasladar al paciente',
      );
    }

    const emergencia = await this.buscarEmergencia(asignacion.emergenciaId);
    const llegada =
      datos.estado === 'en_escena'
        ? this.verificarLlegada(datos, emergencia, observacion)
        : null;

    const estadoAnterior = asignacion.estado;
    const ahora = new Date();
    asignacion.avanzar(datos.estado, ahora);
    const efectos = await this.efectosDe(
      datos.estado,
      asignacion,
      emergencia,
      contexto,
      ahora,
    );

    const evento = crearEventoAsignacion({
      asignacionId: asignacion.id,
      estadoAnterior,
      estadoNuevo: datos.estado,
      usuarioId: contexto.usuarioId,
      rolResponsable: datos.rolSolicitante,
      ocurridoEn: ahora,
      posicion: datos.posicion ?? null,
      precisionMetros: datos.precisionMetros ?? null,
      distanciaEscenaMetros: llegada?.distanciaMetros ?? null,
      fueraDeRadio: llegada ? !llegada.dentroDelRadio : false,
      observacion,
    });

    let actualizada: Asignacion;
    try {
      actualizada = await this.asignacionesRepositorio.registrarTransicion(
        asignacion,
        estadoAnterior,
        evento,
        efectos,
      );
    } catch (error) {
      // Dos toques simultáneos: si el otro ya dejó el servicio en el estado
      // pedido, el resultado es el mismo y no es un error para el usuario.
      if (!(error instanceof ConflictoNegocioError)) throw error;
      const vigente = await this.buscarAsignacion(asignacion.id);
      if (vigente.estado === datos.estado) return vigente;
      throw error;
    }

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'asignaciones_servicio',
      entidadId: asignacion.id,
      accion: 'avanzar',
      detalle: {
        estadoAnterior,
        estadoNuevo: datos.estado,
        emergenciaCerrada: efectos.emergencia?.emergencia.estado === 'cerrada',
        ...(llegada && {
          distanciaEscenaMetros: llegada.distanciaMetros,
          fueraDeRadio: !llegada.dentroDelRadio,
        }),
      },
      direccionIp: contexto.direccionIp,
    });
    this.publicarCambios(actualizada, efectos);

    return actualizada;
  }

  /**
   * El radio es solo una referencia: fuera de él, el conductor puede confirmar
   * igual si lo dice explícitamente y explica por qué (por ejemplo, la
   * emergencia se ubicó con una dirección aproximada).
   */
  private verificarLlegada(
    datos: AvanzarAsignacionEntrada,
    emergencia: Emergencia,
    observacion: string | null,
  ): VerificacionLlegada {
    if (!datos.posicion) {
      throw new ReglaNegocioError(
        'Envíe la ubicación GPS del celular para confirmar la llegada',
      );
    }
    const radio = this.configuracion.radioLlegadaMetros;
    const verificacion = verificarLlegada(
      datos.posicion,
      emergencia.coordenadas,
      radio,
    );
    if (
      !verificacion.dentroDelRadio &&
      !(datos.confirmarFueraDeRadio && observacion)
    ) {
      throw new ReglaNegocioError(
        `Está a ${Math.round(verificacion.distanciaMetros ?? 0)} m de la emergencia (radio de ${radio} m). Si ya llegó, confirme la llegada indicando el motivo`,
      );
    }
    return verificacion;
  }

  private async efectosDe(
    estado: EstadoAvance,
    asignacion: Asignacion,
    emergencia: Emergencia,
    contexto: ContextoSolicitud,
    ahora: Date,
  ): Promise<{ ambulancia?: CambioAmbulancia; emergencia?: CambioEmergencia }> {
    if (estado === 'en_escena') {
      const anterior = emergencia.estado;
      emergencia.iniciarAtencion();
      return emergencia.estado !== anterior
        ? { emergencia: { emergencia, estadoAnterior: anterior } }
        : {};
    }

    if (estado !== 'finalizada') return {};

    const ambulancia = await this.ambulanciasRepositorio.buscarPorId(
      asignacion.ambulanciaId,
    );
    if (!ambulancia) throw new RecursoNoEncontradoError('Ambulancia');
    ambulancia.finalizarServicio();

    // La emergencia se cierra cuando termina su último servicio activo.
    const anterior = emergencia.estado;
    const otras = await this.asignacionesRepositorio.contarActivasDeEmergencia(
      emergencia.id,
      asignacion.id,
    );
    if (otras === 0) emergencia.cerrar(ahora);

    return {
      ambulancia: {
        ambulancia,
        cambio: {
          id: crypto.randomUUID(),
          ambulanciaId: ambulancia.id,
          estadoAnterior: 'en_servicio',
          estadoNuevo: 'disponible',
          motivo: `Servicio finalizado (${asignacion.numeroEmergencia ?? asignacion.emergenciaId})`,
          usuarioId: contexto.usuarioId,
          cambiadoEn: ahora,
        },
      },
      emergencia: {
        emergencia,
        estadoAnterior: anterior,
        sinOtrasAsignacionesActivas: otras === 0,
      },
    };
  }

  private publicarCambios(
    asignacion: Asignacion,
    efectos: { ambulancia?: CambioAmbulancia; emergencia?: CambioEmergencia },
  ): void {
    this.eventos.publicar({
      tipo: 'asignacion.actualizada',
      asignacionId: asignacion.id,
    });
    if (efectos.ambulancia) {
      this.eventos.publicar({
        tipo: 'ambulancia.actualizada',
        ambulanciaId: asignacion.ambulanciaId,
      });
    }
    if (
      efectos.emergencia &&
      efectos.emergencia.emergencia.estado !== efectos.emergencia.estadoAnterior
    ) {
      this.eventos.publicar({
        tipo: 'emergencia.actualizada',
        emergenciaId: asignacion.emergenciaId,
        cambios: ['estado'],
      });
    }
  }

  private async buscarAsignacion(id: string): Promise<Asignacion> {
    const asignacion = await this.asignacionesRepositorio.buscarPorId(id);
    if (!asignacion) throw new RecursoNoEncontradoError('Asignación');
    return asignacion;
  }

  private async buscarEmergencia(id: string): Promise<Emergencia> {
    const emergencia = await this.emergenciasRepositorio.buscarPorId(id);
    if (!emergencia) throw new RecursoNoEncontradoError('Emergencia');
    return emergencia;
  }
}
