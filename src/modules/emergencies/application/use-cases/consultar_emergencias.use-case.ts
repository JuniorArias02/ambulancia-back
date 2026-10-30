import { Injectable } from '@nestjs/common';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type { Emergencia } from '../../domain/entities/emergencia.entity.js';
import {
  EmergenciasRepositorio,
  type FiltrosEmergencias,
} from '../../domain/repositories/emergencias.repository.js';

@Injectable()
export class ConsultarEmergencias {
  constructor(
    private readonly emergenciasRepositorio: EmergenciasRepositorio,
  ) {}

  ejecutar(
    filtros: FiltrosEmergencias,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<Emergencia>> {
    return this.emergenciasRepositorio.listar(filtros, paginacion);
  }
}
