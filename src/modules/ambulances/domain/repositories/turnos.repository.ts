import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type { Ambulancia } from '../entities/ambulancia.entity.js';
import type { CambioEstadoAmbulancia } from '../entities/cambio_estado_ambulancia.entity.js';
import type {
  EstadoTurno,
  NuevoIntegrante,
  Turno,
} from '../entities/turno.entity.js';

export interface FiltrosTurnos {
  ambulanciaId?: string;
  usuarioId?: string;
  estado?: EstadoTurno;
}

/** Qué filas se reservan mientras cambia la tripulación. */
export interface BloqueoTripulacion {
  ambulanciaId: string;
  usuarioId?: string;
}

/** Lecturas y escrituras que ocurren dentro de la misma transacción con bloqueo. */
export interface OperacionesTripulacion {
  buscarAmbulancia(id: string): Promise<Ambulancia | null>;
  buscarTurnoActivoDeAmbulancia(ambulanciaId: string): Promise<Turno | null>;
  buscarTurnoActivoDeUsuario(usuarioId: string): Promise<Turno | null>;
  /** Si el turno ya tuvo servicios, su tripulación queda fija: es el registro de quién los atendió. */
  tieneServicios(turnoId: string): Promise<boolean>;
  crearTurno(turno: Turno): Promise<Turno>;
  agregarIntegrante(turnoId: string, nuevo: NuevoIntegrante): Promise<Turno>;
  finalizarTurno(turno: Turno): Promise<Turno>;
  cambiarEstadoAmbulancia(
    ambulancia: Ambulancia,
    cambio: CambioEstadoAmbulancia,
  ): Promise<void>;
}

export abstract class TurnosRepositorio {
  abstract buscarPorId(id: string): Promise<Turno | null>;
  abstract buscarActivoDeAmbulancia(
    ambulanciaId: string,
  ): Promise<Turno | null>;
  abstract buscarActivoDeUsuario(usuarioId: string): Promise<Turno | null>;
  abstract listar(
    filtros: FiltrosTurnos,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<Turno>>;
  abstract listarActivos(): Promise<Turno[]>;
  /**
   * Ejecuta `trabajo` en una transacción con la ambulancia y el usuario bloqueados:
   * dos selecciones simultáneas se atienden una después de la otra.
   */
  abstract enExclusiva<T>(
    bloqueo: BloqueoTripulacion,
    trabajo: (operaciones: OperacionesTripulacion) => Promise<T>,
  ): Promise<T>;
}
