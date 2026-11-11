import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type { ListaChequeo } from '../entities/lista_chequeo.entity.js';

export interface FiltrosListasChequeo {
  activa?: boolean;
  busqueda?: string;
}

export abstract class ListasChequeoRepositorio {
  abstract buscarPorId(id: string): Promise<ListaChequeo | null>;
  /** La única lista activa, o `null` si el administrador no ha activado ninguna. */
  abstract buscarActiva(): Promise<ListaChequeo | null>;
  abstract listar(
    filtros: FiltrosListasChequeo,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<ListaChequeo>>;
  /** La lista con sus preguntas y opciones, en una transacción. */
  abstract crear(lista: ListaChequeo): Promise<ListaChequeo>;
  /** Datos, `activa`, preguntas y opciones (crea las nuevas, actualiza las demás). */
  abstract actualizar(lista: ListaChequeo): Promise<ListaChequeo>;
  /** Activa esta lista y desactiva todas las demás en la misma transacción. */
  abstract activarUnica(lista: ListaChequeo): Promise<ListaChequeo>;
  abstract itemTieneRespuestas(itemId: string): Promise<boolean>;
}
