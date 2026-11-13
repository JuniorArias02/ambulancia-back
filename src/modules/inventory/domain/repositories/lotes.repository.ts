import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type { Lote } from '../entities/lote.entity.js';

export interface FiltrosLotes {
  insumoId?: string;
  busqueda?: string;
  /** "AAAA-MM-DD": los que vencen hasta esa fecha (inclusive). */
  vencenHasta?: string;
}

export abstract class LotesRepositorio {
  abstract buscarPorId(id: string): Promise<Lote | null>;
  abstract buscarVarios(ids: readonly string[]): Promise<Lote[]>;
  abstract existeNumero(insumoId: string, numeroLote: string): Promise<boolean>;
  abstract listar(
    filtros: FiltrosLotes,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<Lote>>;
  abstract crear(lote: Lote): Promise<Lote>;
  abstract actualizar(lote: Lote): Promise<Lote>;
}
