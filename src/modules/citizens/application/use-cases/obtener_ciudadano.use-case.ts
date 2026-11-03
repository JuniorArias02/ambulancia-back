import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type { Ciudadano } from '../../domain/entities/ciudadano.entity.js';
import { CiudadanosRepositorio } from '../../domain/repositories/ciudadanos.repository.js';

/** El ciudadano autenticado; también lo usan los demás casos de uso del módulo. */
@Injectable()
export class ObtenerCiudadano {
  constructor(private readonly ciudadanosRepositorio: CiudadanosRepositorio) {}

  async ejecutar(usuarioId: string | null): Promise<Ciudadano> {
    const ciudadano = usuarioId
      ? await this.ciudadanosRepositorio.buscarPorUsuarioId(usuarioId)
      : null;
    if (!ciudadano) throw new RecursoNoEncontradoError('Ciudadano');
    return ciudadano;
  }
}
