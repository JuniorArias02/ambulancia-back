import { Injectable } from '@nestjs/common';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type { Asignacion } from '../../domain/entities/asignacion.entity.js';
import {
  AsignacionesRepositorio,
  type FiltrosAsignaciones,
} from '../../domain/repositories/asignaciones.repository.js';

@Injectable()
export class ConsultarAsignaciones {
  constructor(
    private readonly asignacionesRepositorio: AsignacionesRepositorio,
  ) {}

  ejecutar(
    filtros: FiltrosAsignaciones,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<Asignacion>> {
    return this.asignacionesRepositorio.listar(filtros, paginacion);
  }
}
