import { Injectable } from '@nestjs/common';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type { Turno } from '../../domain/entities/turno.entity.js';
import {
  type FiltrosTurnos,
  TurnosRepositorio,
} from '../../domain/repositories/turnos.repository.js';

@Injectable()
export class ConsultarTurnos {
  constructor(private readonly turnosRepositorio: TurnosRepositorio) {}

  ejecutar(
    filtros: FiltrosTurnos,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<Turno>> {
    return this.turnosRepositorio.listar(filtros, paginacion);
  }
}
