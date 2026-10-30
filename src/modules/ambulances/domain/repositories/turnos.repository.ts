import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type { EstadoTurno, Turno } from '../entities/turno.entity.js';

export interface FiltrosTurnos {
  ambulanciaId?: string;
  usuarioId?: string;
  estado?: EstadoTurno;
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
  /** Falla con 409 si la ambulancia ya tiene un turno activo. */
  abstract crear(turno: Turno): Promise<Turno>;
  abstract reemplazarIntegrantes(turno: Turno): Promise<Turno>;
  /** Falla con 409 si otro usuario lo finalizó mientras tanto. */
  abstract finalizar(turno: Turno): Promise<Turno>;
}
