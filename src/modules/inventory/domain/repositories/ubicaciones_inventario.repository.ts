import type {
  TipoUbicacion,
  UbicacionInventario,
} from '../entities/ubicacion_inventario.entity.js';

export interface FiltrosUbicaciones {
  tipo?: TipoUbicacion;
  activa?: boolean;
}

export abstract class UbicacionesInventarioRepositorio {
  abstract buscarPorId(id: string): Promise<UbicacionInventario | null>;
  abstract buscarDeAmbulancia(
    ambulanciaId: string,
  ): Promise<UbicacionInventario | null>;
  /**
   * Crea la ubicación de la ambulancia si no existe. Dos solicitudes
   * simultáneas terminan con una sola (`creada: false` para la segunda).
   */
  abstract asegurarDeAmbulancia(
    ubicacion: UbicacionInventario,
  ): Promise<{ ubicacion: UbicacionInventario; creada: boolean }>;
  abstract listar(filtros: FiltrosUbicaciones): Promise<UbicacionInventario[]>;
  abstract cambiarEstado(
    ubicacion: UbicacionInventario,
  ): Promise<UbicacionInventario>;
}
