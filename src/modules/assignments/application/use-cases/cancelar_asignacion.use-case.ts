import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import { PublicadorEventos } from '../../../../common/events/publicador_eventos.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AmbulanciasRepositorio } from '../../../ambulances/domain/repositories/ambulancias.repository.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import { EmergenciasRepositorio } from '../../../emergencies/domain/repositories/emergencias.repository.js';
import type { Asignacion } from '../../domain/entities/asignacion.entity.js';
import { crearEventoAsignacion } from '../../domain/entities/evento_asignacion.entity.js';
import { AsignacionesRepositorio } from '../../domain/repositories/asignaciones.repository.js';

export interface CancelarAsignacionEntrada {
  asignacionId: string;
  motivo: string;
}

/**
 * La ambulancia vuelve a quedar disponible. Si era el único servicio de la
 * emergencia, esta vuelve a recibida para despachar otra ambulancia.
 */
@Injectable()
export class CancelarAsignacion {
  constructor(
    private readonly asignacionesRepositorio: AsignacionesRepositorio,
    private readonly emergenciasRepositorio: EmergenciasRepositorio,
    private readonly ambulanciasRepositorio: AmbulanciasRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
    private readonly eventos: PublicadorEventos,
  ) {}

  async ejecutar(
    datos: CancelarAsignacionEntrada,
    contexto: ContextoSolicitud,
  ): Promise<Asignacion> {
    const asignacion = await this.asignacionesRepositorio.buscarPorId(
      datos.asignacionId,
    );
    if (!asignacion) throw new RecursoNoEncontradoError('Asignación');

    const estadoAnterior = asignacion.estado;
    const ahora = new Date();
    asignacion.cancelar(datos.motivo, ahora);

    const ambulancia = await this.ambulanciasRepositorio.buscarPorId(
      asignacion.ambulanciaId,
    );
    if (!ambulancia) throw new RecursoNoEncontradoError('Ambulancia');
    ambulancia.finalizarServicio();

    const emergencia = await this.emergenciasRepositorio.buscarPorId(
      asignacion.emergenciaId,
    );
    if (!emergencia) throw new RecursoNoEncontradoError('Emergencia');
    const estadoEmergenciaAnterior = emergencia.estado;
    const otras = await this.asignacionesRepositorio.contarActivasDeEmergencia(
      emergencia.id,
      asignacion.id,
    );
    if (otras === 0) {
      // Si otra ambulancia ya atendió y terminó, la emergencia queda cerrada.
      if (emergencia.estado === 'en_atencion') emergencia.cerrar(ahora);
      else emergencia.volverARecibida();
    }

    const cancelada = await this.asignacionesRepositorio.registrarTransicion(
      asignacion,
      estadoAnterior,
      crearEventoAsignacion({
        asignacionId: asignacion.id,
        estadoAnterior,
        estadoNuevo: 'cancelada',
        usuarioId: contexto.usuarioId,
        rolResponsable: contexto.rol ?? null,
        ocurridoEn: ahora,
        observacion: datos.motivo.trim(),
      }),
      {
        ambulancia: {
          ambulancia,
          cambio: {
            id: crypto.randomUUID(),
            ambulanciaId: ambulancia.id,
            estadoAnterior: 'en_servicio',
            estadoNuevo: 'disponible',
            motivo: `Asignación cancelada: ${datos.motivo}`.slice(0, 255),
            usuarioId: contexto.usuarioId,
            cambiadoEn: ahora,
          },
        },
        emergencia: {
          emergencia,
          estadoAnterior: estadoEmergenciaAnterior,
          sinOtrasAsignacionesActivas: otras === 0,
        },
      },
    );

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'asignaciones_servicio',
      entidadId: asignacion.id,
      accion: 'cancelar',
      detalle: {
        estadoAnterior,
        motivo: datos.motivo,
        estadoEmergencia: emergencia.estado,
      },
      direccionIp: contexto.direccionIp,
    });
    this.eventos.publicar(
      { tipo: 'asignacion.actualizada', asignacionId: asignacion.id },
      { tipo: 'ambulancia.actualizada', ambulanciaId: ambulancia.id },
    );
    if (emergencia.estado !== estadoEmergenciaAnterior) {
      this.eventos.publicar({
        tipo: 'emergencia.actualizada',
        emergenciaId: emergencia.id,
        cambios: ['estado'],
      });
    }

    return cancelada;
  }
}
