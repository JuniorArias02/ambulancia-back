import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type { Existencia } from '../entities/existencia.js';
import type { TipoInsumo } from '../entities/insumo.entity.js';
import type { TipoUbicacion } from '../entities/ubicacion_inventario.entity.js';

export interface FiltrosExistencias {
  ubicacionId?: string;
  tipoUbicacion?: TipoUbicacion;
  insumoId?: string;
  tipoInsumo?: TipoInsumo;
  busqueda?: string;
  /** Por defecto solo lo que tiene cantidad mayor que 0. */
  incluirAgotadas?: boolean;
}

export abstract class ExistenciasRepositorio {
  abstract listar(
    filtros: FiltrosExistencias,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<Existencia>>;
  /** Todo lo que hay (cantidad > 0) en una ubicación. */
  abstract deUbicacion(ubicacionId: string): Promise<Existencia[]>;
  /** 0 si no hay registro. */
  abstract cantidadEn(
    ubicacionId: string,
    claveControl: string,
  ): Promise<number>;
}
