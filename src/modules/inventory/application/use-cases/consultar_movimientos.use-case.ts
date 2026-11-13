import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type { Movimiento } from '../../domain/entities/movimiento.entity.js';
import {
  type FiltrosMovimientos,
  MovimientosRepositorio,
} from '../../domain/repositories/movimientos.repository.js';

@Injectable()
export class ConsultarMovimientos {
  constructor(private readonly movimientos: MovimientosRepositorio) {}

  listar(
    filtros: FiltrosMovimientos,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<Movimiento>> {
    return this.movimientos.listar(filtros, paginacion);
  }

  /** Con `ubicacionId`, solo si el movimiento la toca (si no, 404: no revela que existe). */
  async obtener(id: string, ubicacionId?: string): Promise<Movimiento> {
    const movimiento = await this.movimientos.buscarPorId(id);
    if (!movimiento || (ubicacionId && !movimiento.involucraA(ubicacionId))) {
      throw new RecursoNoEncontradoError('Movimiento');
    }
    return movimiento;
  }
}
