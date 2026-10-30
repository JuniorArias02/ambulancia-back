import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type { Asignacion } from '../../domain/entities/asignacion.entity.js';
import { AsignacionesRepositorio } from '../../domain/repositories/asignaciones.repository.js';

@Injectable()
export class ObtenerAsignacion {
  constructor(
    private readonly asignacionesRepositorio: AsignacionesRepositorio,
  ) {}

  async ejecutar(asignacionId: string): Promise<Asignacion> {
    const asignacion =
      await this.asignacionesRepositorio.buscarPorId(asignacionId);
    if (!asignacion) throw new RecursoNoEncontradoError('Asignación');
    return asignacion;
  }
}
