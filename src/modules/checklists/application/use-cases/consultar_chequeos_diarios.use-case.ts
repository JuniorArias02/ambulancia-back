import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type { ChequeoDiario } from '../../domain/entities/chequeo_diario.entity.js';
import {
  ChequeosDiariosRepositorio,
  type FiltrosChequeosDiarios,
} from '../../domain/repositories/chequeos_diarios.repository.js';
import { ListasChequeoRepositorio } from '../../domain/repositories/listas_chequeo.repository.js';
import type { ChequeoConLista } from './responder_chequeo_diario.use-case.js';

/**
 * Historial. `soloDelConductor` lo pone el controlador del conductor: así solo
 * ve los suyos, aunque pida otro `conductorId`.
 */
@Injectable()
export class ConsultarChequeosDiarios {
  constructor(
    private readonly chequeosRepositorio: ChequeosDiariosRepositorio,
    private readonly listasRepositorio: ListasChequeoRepositorio,
  ) {}

  listar(
    filtros: FiltrosChequeosDiarios,
    paginacion: Paginacion,
    soloDelConductor?: string,
  ): Promise<ResultadoPaginado<ChequeoDiario>> {
    return this.chequeosRepositorio.listar(
      soloDelConductor
        ? { ...filtros, conductorId: soloDelConductor }
        : filtros,
      paginacion,
    );
  }

  /** Un chequeo ajeno responde 404 al conductor, igual que uno inexistente. */
  async obtener(
    id: string,
    soloDelConductor?: string,
  ): Promise<ChequeoConLista> {
    const chequeo = await this.chequeosRepositorio.buscarPorId(id);
    if (
      !chequeo ||
      (soloDelConductor && chequeo.conductorId !== soloDelConductor)
    ) {
      throw new RecursoNoEncontradoError('Chequeo diario');
    }
    const lista = await this.listasRepositorio.buscarPorId(
      chequeo.listaChequeoId,
    );
    if (!lista) throw new RecursoNoEncontradoError('Lista de chequeo');
    return { chequeo, lista };
  }
}
