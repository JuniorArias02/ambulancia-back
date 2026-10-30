import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type { InstitucionSalud } from '../../domain/entities/institucion_salud.entity.js';
import { InstitucionesSaludRepositorio } from '../../domain/repositories/instituciones_salud.repository.js';

@Injectable()
export class ObtenerInstitucionSalud {
  constructor(
    private readonly institucionesRepositorio: InstitucionesSaludRepositorio,
  ) {}

  async ejecutar(institucionId: string): Promise<InstitucionSalud> {
    const institucion =
      await this.institucionesRepositorio.buscarPorId(institucionId);
    if (!institucion)
      throw new RecursoNoEncontradoError('Institución de salud');
    return institucion;
  }
}
