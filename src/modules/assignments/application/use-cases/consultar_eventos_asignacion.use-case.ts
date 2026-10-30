import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type { EventoAsignacion } from '../../domain/entities/evento_asignacion.entity.js';
import { AsignacionesRepositorio } from '../../domain/repositories/asignaciones.repository.js';
import {
  PermisoServicio,
  type Solicitante,
} from '../services/permiso_servicio.service.js';

/** Línea de tiempo del servicio: cada paso con su responsable, hora y posición. */
@Injectable()
export class ConsultarEventosAsignacion {
  constructor(
    private readonly asignacionesRepositorio: AsignacionesRepositorio,
    private readonly permisos: PermisoServicio,
  ) {}

  async ejecutar(
    asignacionId: string,
    solicitante: Solicitante,
  ): Promise<EventoAsignacion[]> {
    const asignacion =
      await this.asignacionesRepositorio.buscarPorId(asignacionId);
    if (!asignacion) throw new RecursoNoEncontradoError('Asignación');
    await this.permisos.exigirCentralOTripulacion(asignacion, solicitante);
    return this.asignacionesRepositorio.listarEventos(asignacionId);
  }
}
