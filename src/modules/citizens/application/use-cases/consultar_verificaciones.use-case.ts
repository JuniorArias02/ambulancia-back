import { Injectable } from '@nestjs/common';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type { Ciudadano } from '../../domain/entities/ciudadano.entity.js';
import {
  CiudadanosRepositorio,
  type FiltrosVerificaciones,
} from '../../domain/repositories/ciudadanos.repository.js';

/** Fila de trabajo del administrador: por defecto, las más antiguas primero. */
@Injectable()
export class ConsultarVerificaciones {
  constructor(private readonly ciudadanosRepositorio: CiudadanosRepositorio) {}

  ejecutar(
    filtros: FiltrosVerificaciones,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<Ciudadano>> {
    return this.ciudadanosRepositorio.listar(filtros, paginacion);
  }
}
