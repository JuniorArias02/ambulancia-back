import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type { Ambulancia } from '../../../ambulances/domain/entities/ambulancia.entity.js';
import type { CambioEstadoAmbulancia } from '../../../ambulances/domain/entities/cambio_estado_ambulancia.entity.js';
import type {
  Emergencia,
  EstadoEmergencia,
} from '../../../emergencies/domain/entities/emergencia.entity.js';
import type {
  Asignacion,
  EstadoAsignacion,
} from '../entities/asignacion.entity.js';
import type { EventoAsignacion } from '../entities/evento_asignacion.entity.js';

export interface FiltrosAsignaciones {
  emergenciaId?: string;
  ambulanciaId?: string;
  estado?: EstadoAsignacion;
  /** asignada, en_camino, en_escena o trasladando. Se ignora si viene `estado`. */
  soloActivas?: boolean;
}

/** Nuevo estado de la ambulancia y su fila de historial. */
export interface CambioAmbulancia {
  ambulancia: Ambulancia;
  cambio: CambioEstadoAmbulancia;
}

export interface CambioEmergencia {
  emergencia: Emergencia;
  estadoAnterior: EstadoEmergencia;
  /**
   * Lo que el caso de uso supuso al decidir si cerrar la emergencia. Dentro
   * de la transacción se vuelve a contar; si no coincide, falla con 409.
   */
  sinOtrasAsignacionesActivas?: boolean;
}

export abstract class AsignacionesRepositorio {
  abstract buscarPorId(id: string): Promise<Asignacion | null>;
  abstract buscarActivaDeAmbulancia(
    ambulanciaId: string,
  ): Promise<Asignacion | null>;
  abstract contarActivasDeEmergencia(
    emergenciaId: string,
    excluirId: string,
  ): Promise<number>;
  abstract listar(
    filtros: FiltrosAsignaciones,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<Asignacion>>;
  /**
   * Crea la asignación con su primer evento (despacho), pone la ambulancia
   * en servicio y actualiza la emergencia en una sola transacción. Falla con
   * 409 si la ambulancia dejó de estar disponible (así no se asigna a dos
   * emergencias).
   */
  abstract registrarDespacho(
    asignacion: Asignacion,
    evento: EventoAsignacion,
    ambulancia: CambioAmbulancia,
    emergencia: CambioEmergencia,
  ): Promise<Asignacion>;
  /**
   * Guarda un avance o una cancelación, su evento y sus efectos en una sola
   * transacción. Falla con 409 si la asignación ya no estaba en
   * `estadoAnterior` o si ese evento ya estaba registrado.
   */
  abstract registrarTransicion(
    asignacion: Asignacion,
    estadoAnterior: EstadoAsignacion,
    evento: EventoAsignacion,
    efectos: { ambulancia?: CambioAmbulancia; emergencia?: CambioEmergencia },
  ): Promise<Asignacion>;
  /**
   * Guarda el destino con quién y cuándo lo definió. Falla con 409 si el servicio
   * ya salió de los estados que lo permiten.
   */
  abstract registrarDestino(asignacion: Asignacion): Promise<Asignacion>;
  /** Línea de tiempo del servicio, del primer evento al último. */
  abstract listarEventos(asignacionId: string): Promise<EventoAsignacion[]>;
}
