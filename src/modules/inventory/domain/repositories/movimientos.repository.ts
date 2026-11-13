import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type {
  EstadoMovimiento,
  Movimiento,
  TipoMovimiento,
} from '../entities/movimiento.entity.js';

export interface FiltrosMovimientos {
  tipo?: TipoMovimiento;
  estado?: EstadoMovimiento;
  /** Como origen o como destino. */
  ubicacionId?: string;
  asignacionId?: string;
  usuarioId?: string;
  insumoId?: string;
  /** "AAAA-MM-DD", días de Colombia, inclusive. */
  desde?: string;
  hasta?: string;
}

export abstract class MovimientosRepositorio {
  abstract buscarPorId(id: string): Promise<Movimiento | null>;
  /**
   * Guarda el movimiento. Si ya viene confirmado, aplica sus efectos en la
   * misma transacción: o queda todo o no queda nada.
   */
  abstract registrar(movimiento: Movimiento): Promise<Movimiento>;
  /**
   * Pasa de borrador a confirmado y aplica los efectos. 409 si otra solicitud
   * lo confirmó o anuló antes, o si alguna existencia no alcanza.
   */
  abstract confirmar(movimiento: Movimiento): Promise<Movimiento>;
  /** 409 si ya no está en borrador. */
  abstract anular(movimiento: Movimiento): Promise<Movimiento>;
  abstract listar(
    filtros: FiltrosMovimientos,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<Movimiento>>;
}
