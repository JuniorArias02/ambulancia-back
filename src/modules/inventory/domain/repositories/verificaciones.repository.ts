import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type {
  EstadoVerificacion,
  TipoVerificacion,
  Verificacion,
} from '../entities/verificacion.entity.js';

export interface FiltrosVerificaciones {
  ubicacionId?: string;
  responsableId?: string;
  estado?: EstadoVerificacion;
  tipo?: TipoVerificacion;
  /** `false`: con novedades sin atender; `true`: ya revisadas. */
  revisada?: boolean;
  /** "AAAA-MM-DD", días de Colombia, inclusive. */
  desde?: string;
  hasta?: string;
}

export abstract class VerificacionesRepositorio {
  abstract buscarPorId(id: string): Promise<Verificacion | null>;
  abstract buscarBorradorDeUbicacion(
    ubicacionId: string,
  ): Promise<Verificacion | null>;
  /**
   * Una sola en borrador por ubicación: si ya hay una, la devuelve con
   * `creada: false` en lugar de crear otra.
   */
  abstract crear(
    verificacion: Verificacion,
  ): Promise<{ verificacion: Verificacion; creada: boolean }>;
  /** Guarda los conteos. 409 si ya no está en borrador. */
  abstract guardarConteos(verificacion: Verificacion): Promise<Verificacion>;
  /** 409 si otra solicitud la finalizó antes. */
  abstract finalizar(verificacion: Verificacion): Promise<Verificacion>;
  /** Guarda la revisión. 409 si otra solicitud ya la revisó. */
  abstract revisar(verificacion: Verificacion): Promise<Verificacion>;
  abstract listar(
    filtros: FiltrosVerificaciones,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<Verificacion>>;
}
