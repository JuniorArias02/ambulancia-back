import { Injectable } from '@nestjs/common';
import {
  RecursoNoEncontradoError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import { PublicadorEventos } from '../../../../common/events/publicador_eventos.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AmbulanciasRepositorio } from '../../../ambulances/domain/repositories/ambulancias.repository.js';
import { TurnosRepositorio } from '../../../ambulances/domain/repositories/turnos.repository.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import { EmergenciasRepositorio } from '../../../emergencies/domain/repositories/emergencias.repository.js';
import { Asignacion } from '../../domain/entities/asignacion.entity.js';
import { crearEventoAsignacion } from '../../domain/entities/evento_asignacion.entity.js';
import { AsignacionesRepositorio } from '../../domain/repositories/asignaciones.repository.js';

export interface DespacharAmbulanciaEntrada {
  emergenciaId: string;
  ambulanciaId: string;
}

/** Una emergencia puede recibir varias ambulancias (por ejemplo, varias víctimas). */
@Injectable()
export class DespacharAmbulancia {
  constructor(
    private readonly asignacionesRepositorio: AsignacionesRepositorio,
    private readonly emergenciasRepositorio: EmergenciasRepositorio,
    private readonly ambulanciasRepositorio: AmbulanciasRepositorio,
    private readonly turnosRepositorio: TurnosRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
    private readonly eventos: PublicadorEventos,
  ) {}

  async ejecutar(
    datos: DespacharAmbulanciaEntrada,
    contexto: ContextoSolicitud,
  ): Promise<Asignacion> {
    const emergencia = await this.emergenciasRepositorio.buscarPorId(
      datos.emergenciaId,
    );
    if (!emergencia) throw new RecursoNoEncontradoError('Emergencia');
    const ambulancia = await this.ambulanciasRepositorio.buscarPorId(
      datos.ambulanciaId,
    );
    if (!ambulancia) throw new RecursoNoEncontradoError('Ambulancia');

    const turno = await this.turnosRepositorio.buscarActivoDeAmbulancia(
      ambulancia.id,
    );
    if (!turno) {
      throw new ReglaNegocioError(
        `La ambulancia ${ambulancia.codigo} no tiene un turno activo`,
      );
    }

    const estadoEmergenciaAnterior = emergencia.estado;
    emergencia.despachar();
    ambulancia.iniciarServicio();
    const ahora = new Date();
    const nueva = Asignacion.crear({
      emergenciaId: emergencia.id,
      ambulanciaId: ambulancia.id,
      turnoId: turno.id,
      asignadaPorId: contexto.usuarioId,
      asignadaEn: ahora,
    });

    const asignacion = await this.asignacionesRepositorio.registrarDespacho(
      nueva,
      // Primer evento del ciclo: quién despachó y cuándo.
      crearEventoAsignacion({
        asignacionId: nueva.id,
        estadoAnterior: null,
        estadoNuevo: 'asignada',
        usuarioId: contexto.usuarioId,
        rolResponsable: contexto.rol ?? null,
        ocurridoEn: ahora,
      }),
      {
        ambulancia,
        cambio: {
          id: crypto.randomUUID(),
          ambulanciaId: ambulancia.id,
          estadoAnterior: 'disponible',
          estadoNuevo: 'en_servicio',
          motivo: `Despachada a ${emergencia.numeroEmergencia}`,
          usuarioId: contexto.usuarioId,
          cambiadoEn: ahora,
        },
      },
      { emergencia, estadoAnterior: estadoEmergenciaAnterior },
    );

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'asignaciones_servicio',
      entidadId: asignacion.id,
      accion: 'despachar',
      detalle: {
        emergenciaId: emergencia.id,
        numeroEmergencia: emergencia.numeroEmergencia,
        ambulanciaId: ambulancia.id,
        ambulanciaCodigo: ambulancia.codigo,
      },
      direccionIp: contexto.direccionIp,
    });
    this.eventos.publicar(
      { tipo: 'asignacion.creada', asignacionId: asignacion.id },
      { tipo: 'ambulancia.actualizada', ambulanciaId: ambulancia.id },
    );
    if (emergencia.estado !== estadoEmergenciaAnterior) {
      this.eventos.publicar({
        tipo: 'emergencia.actualizada',
        emergenciaId: emergencia.id,
        cambios: ['estado'],
      });
    }

    return asignacion;
  }
}
