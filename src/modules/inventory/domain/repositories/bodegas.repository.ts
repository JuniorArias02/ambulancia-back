import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type { Bodega } from '../entities/bodega.entity.js';
import type { UbicacionInventario } from '../entities/ubicacion_inventario.entity.js';

export interface FiltrosBodegas {
  busqueda?: string;
  activa?: boolean;
}

export abstract class BodegasRepositorio {
  abstract buscarPorId(id: string): Promise<Bodega | null>;
  abstract existeCodigo(codigo: string, excluirId?: string): Promise<boolean>;
  abstract listar(
    filtros: FiltrosBodegas,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<Bodega>>;
  /** Crea la bodega y su ubicación de inventario en la misma transacción. */
  abstract crear(
    bodega: Bodega,
    ubicacion: UbicacionInventario,
  ): Promise<Bodega>;
  /** Activar o desactivar la bodega hace lo mismo con su ubicación. */
  abstract actualizar(bodega: Bodega): Promise<Bodega>;
}
