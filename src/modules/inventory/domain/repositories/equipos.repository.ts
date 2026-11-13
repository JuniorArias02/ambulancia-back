import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type {
  Equipo,
  EstadoEquipo,
  Mantenimiento,
} from '../entities/equipo.entity.js';

export interface FiltrosEquipos {
  insumoId?: string;
  estado?: EstadoEquipo;
  busqueda?: string;
  /** "AAAA-MM-DD": próximo mantenimiento hasta esa fecha (inclusive). */
  mantenimientoHasta?: string;
}

export abstract class EquiposRepositorio {
  abstract buscarPorId(id: string): Promise<Equipo | null>;
  abstract buscarVarios(ids: readonly string[]): Promise<Equipo[]>;
  abstract existeSerie(numeroSerie: string): Promise<boolean>;
  abstract listar(
    filtros: FiltrosEquipos,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<Equipo>>;
  abstract crear(equipo: Equipo): Promise<Equipo>;
  abstract actualizar(equipo: Equipo): Promise<Equipo>;
  /** Guarda el mantenimiento y las fechas del equipo en una transacción. */
  abstract registrarMantenimiento(
    equipo: Equipo,
    mantenimiento: Mantenimiento,
  ): Promise<Equipo>;
  abstract listarMantenimientos(equipoId: string): Promise<Mantenimiento[]>;
}
