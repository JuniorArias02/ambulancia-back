import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type { ListaChequeo } from '../../domain/entities/lista_chequeo.entity.js';
import {
  type FiltrosListasChequeo,
  ListasChequeoRepositorio,
} from '../../domain/repositories/listas_chequeo.repository.js';

@Injectable()
export class ConsultarListasChequeo {
  constructor(private readonly listasRepositorio: ListasChequeoRepositorio) {}

  listar(
    filtros: FiltrosListasChequeo,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<ListaChequeo>> {
    return this.listasRepositorio.listar(filtros, paginacion);
  }

  async obtener(id: string): Promise<ListaChequeo> {
    const lista = await this.listasRepositorio.buscarPorId(id);
    if (!lista) throw new RecursoNoEncontradoError('Lista de chequeo');
    return lista;
  }
}
