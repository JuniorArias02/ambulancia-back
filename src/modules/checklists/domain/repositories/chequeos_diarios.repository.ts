import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type {
  ChequeoDiario,
  EstadoChequeo,
} from '../entities/chequeo_diario.entity.js';

export interface FiltrosChequeosDiarios {
  conductorId?: string;
  ambulanciaId?: string;
  estado?: EstadoChequeo;
  /** "AAAA-MM-DD", inclusive. */
  desde?: string;
  hasta?: string;
}

export interface ClaveChequeoDelDia {
  listaChequeoId: string;
  conductorId: string;
  ambulanciaId: string;
  fecha: string;
}

export abstract class ChequeosDiariosRepositorio {
  abstract buscarPorId(id: string): Promise<ChequeoDiario | null>;
  abstract buscarDelDia(
    clave: ClaveChequeoDelDia,
  ): Promise<ChequeoDiario | null>;
  /** Si el índice único dice que ya existe, devuelve el existente con `creado: false`. */
  abstract crear(
    chequeo: ChequeoDiario,
  ): Promise<{ chequeo: ChequeoDiario; creado: boolean }>;
  /** Guarda las respuestas (una por pregunta). 409 si ya no está en borrador. */
  abstract guardarRespuestas(chequeo: ChequeoDiario): Promise<ChequeoDiario>;
  /** Solo si sigue en borrador. 409 si otra solicitud lo finalizó antes. */
  abstract finalizar(chequeo: ChequeoDiario): Promise<ChequeoDiario>;
  abstract listar(
    filtros: FiltrosChequeosDiarios,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<ChequeoDiario>>;
}
