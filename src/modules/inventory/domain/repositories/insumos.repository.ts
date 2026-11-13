import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type { Insumo, TipoInsumo } from '../entities/insumo.entity.js';

export interface FiltrosInsumos {
  busqueda?: string;
  tipo?: TipoInsumo;
  activo?: boolean;
  esControlEspecial?: boolean;
}

export abstract class InsumosRepositorio {
  abstract buscarPorId(id: string): Promise<Insumo | null>;
  abstract buscarVarios(ids: readonly string[]): Promise<Insumo[]>;
  abstract existeCodigo(codigo: string, excluirId?: string): Promise<boolean>;
  /** Si ya tuvo existencias o movimientos: su forma de control queda fija. */
  abstract tieneHistorial(insumoId: string): Promise<boolean>;
  abstract listar(
    filtros: FiltrosInsumos,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<Insumo>>;
  abstract crear(insumo: Insumo): Promise<Insumo>;
  abstract actualizar(insumo: Insumo): Promise<Insumo>;
}
