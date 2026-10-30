import { Injectable } from '@nestjs/common';
import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type { Ubicacion } from '../../domain/entities/ubicacion.entity.js';
import {
  type FiltrosRecorrido,
  UbicacionesRepositorio,
} from '../../domain/repositories/ubicaciones.repository.js';

@Injectable()
export class ConsultarRecorrido {
  constructor(
    private readonly ubicacionesRepositorio: UbicacionesRepositorio,
  ) {}

  ejecutar(filtros: FiltrosRecorrido, limite: number): Promise<Ubicacion[]> {
    if (!filtros.ambulanciaId && !filtros.asignacionId) {
      throw new ReglaNegocioError('Indique ambulanciaId o asignacionId');
    }
    return this.ubicacionesRepositorio.listarRecorrido(filtros, limite);
  }
}
