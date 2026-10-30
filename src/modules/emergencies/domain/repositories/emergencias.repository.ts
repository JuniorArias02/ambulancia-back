import { ConflictoNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type {
  Emergencia,
  EstadoEmergencia,
  PrioridadEmergencia,
  TipoIncidente,
} from '../entities/emergencia.entity.js';

export interface FiltrosEmergencias {
  busqueda?: string;
  estado?: EstadoEmergencia;
  /** recibida, despachada o en_atencion. Se ignora si viene `estado`. */
  soloActivas?: boolean;
  prioridad?: PrioridadEmergencia;
  tipoIncidente?: TipoIncidente;
  desde?: Date;
  hasta?: Date;
}

/** Otra solicitud tomó el mismo consecutivo; el caso de uso reintenta. */
export class NumeroEmergenciaEnUsoError extends ConflictoNegocioError {
  constructor() {
    super('El número de emergencia ya está en uso');
  }
}

export abstract class EmergenciasRepositorio {
  abstract buscarPorId(id: string): Promise<Emergencia | null>;
  /** Mayor consecutivo usado con ese prefijo, o 0 si no hay. */
  abstract ultimoConsecutivo(prefijo: string): Promise<number>;
  abstract listar(
    filtros: FiltrosEmergencias,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<Emergencia>>;
  /** Lanza `NumeroEmergenciaEnUsoError` si el número ya existe. */
  abstract crear(emergencia: Emergencia): Promise<Emergencia>;
  /**
   * Persiste todos los datos solo si el estado en la base sigue siendo
   * `estadoEsperado`; si otro usuario lo cambió, falla con 409.
   */
  abstract actualizar(
    emergencia: Emergencia,
    estadoEsperado: EstadoEmergencia,
  ): Promise<Emergencia>;
  /** Activas, no duplicadas, recibidas desde `desde`. Para buscar duplicados. */
  abstract listarActivasDesde(
    desde: Date,
    excluirId: string,
  ): Promise<Emergencia[]>;
}
