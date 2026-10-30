import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type { CambioEstadoAmbulancia } from '../../domain/entities/cambio_estado_ambulancia.entity.js';
import { AmbulanciasRepositorio } from '../../domain/repositories/ambulancias.repository.js';

@Injectable()
export class ConsultarHistorialEstadosAmbulancia {
  constructor(
    private readonly ambulanciasRepositorio: AmbulanciasRepositorio,
  ) {}

  async ejecutar(
    ambulanciaId: string,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<CambioEstadoAmbulancia>> {
    const ambulancia =
      await this.ambulanciasRepositorio.buscarPorId(ambulanciaId);
    if (!ambulancia) throw new RecursoNoEncontradoError('Ambulancia');

    return this.ambulanciasRepositorio.listarHistorialEstados(
      ambulanciaId,
      paginacion,
    );
  }
}
