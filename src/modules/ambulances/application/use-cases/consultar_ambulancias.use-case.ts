import { Injectable } from '@nestjs/common';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type { Ambulancia } from '../../domain/entities/ambulancia.entity.js';
import {
  AmbulanciasRepositorio,
  type FiltrosAmbulancias,
} from '../../domain/repositories/ambulancias.repository.js';

@Injectable()
export class ConsultarAmbulancias {
  constructor(
    private readonly ambulanciasRepositorio: AmbulanciasRepositorio,
  ) {}

  ejecutar(
    filtros: FiltrosAmbulancias,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<Ambulancia>> {
    return this.ambulanciasRepositorio.listar(filtros, paginacion);
  }
}
