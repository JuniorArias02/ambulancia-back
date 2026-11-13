import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type { ControlAlmacenamiento } from '../entities/control_almacenamiento.entity.js';

export interface FiltrosControlesAlmacenamiento {
  ubicacionId?: string;
  /** "AAAA-MM-DD", días de Colombia, inclusive. */
  desde?: string;
  hasta?: string;
}

export abstract class ControlesAlmacenamientoRepositorio {
  abstract registrar(
    control: ControlAlmacenamiento,
  ): Promise<ControlAlmacenamiento>;
  abstract listar(
    filtros: FiltrosControlesAlmacenamiento,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<ControlAlmacenamiento>>;
}
