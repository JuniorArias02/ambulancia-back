import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type { Verificacion } from '../../domain/entities/verificacion.entity.js';
import {
  type FiltrosVerificaciones,
  VerificacionesRepositorio,
} from '../../domain/repositories/verificaciones.repository.js';

@Injectable()
export class ConsultarVerificaciones {
  constructor(private readonly verificaciones: VerificacionesRepositorio) {}

  listar(
    filtros: FiltrosVerificaciones,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<Verificacion>> {
    return this.verificaciones.listar(filtros, paginacion);
  }

  /** Con `ubicacionId`, solo si es de esa ubicación (si no, 404). */
  async obtener(id: string, ubicacionId?: string): Promise<Verificacion> {
    const verificacion = await this.verificaciones.buscarPorId(id);
    if (
      !verificacion ||
      (ubicacionId && verificacion.ubicacionId !== ubicacionId)
    ) {
      throw new RecursoNoEncontradoError('Verificación');
    }
    return verificacion;
  }
}
