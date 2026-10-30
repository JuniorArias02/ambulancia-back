import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type {
  Ambulancia,
  EstadoOperativo,
} from '../entities/ambulancia.entity.js';
import type { CambioEstadoAmbulancia } from '../entities/cambio_estado_ambulancia.entity.js';

export interface FiltrosAmbulancias {
  busqueda?: string;
  estadoOperativo?: EstadoOperativo;
  tipoAmbulanciaId?: string;
}

export abstract class AmbulanciasRepositorio {
  abstract buscarPorId(id: string): Promise<Ambulancia | null>;
  /** `excluirId` permite validar al editar sin chocar con la propia ambulancia. */
  abstract existeCodigo(codigo: string, excluirId?: string): Promise<boolean>;
  abstract existePlaca(placa: string, excluirId?: string): Promise<boolean>;
  abstract listar(
    filtros: FiltrosAmbulancias,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<Ambulancia>>;
  abstract crear(ambulancia: Ambulancia): Promise<Ambulancia>;
  /** Persiste código, placa y tipo. El estado se cambia con `cambiarEstado`. */
  abstract actualizar(ambulancia: Ambulancia): Promise<Ambulancia>;
  /**
   * Guarda el nuevo estado y su fila de historial en una sola transacción.
   * Falla si otro usuario cambió el estado mientras tanto.
   */
  abstract cambiarEstado(
    ambulancia: Ambulancia,
    cambio: CambioEstadoAmbulancia,
  ): Promise<Ambulancia>;
  abstract listarHistorialEstados(
    ambulanciaId: string,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<CambioEstadoAmbulancia>>;
}
