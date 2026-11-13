import type { UbicacionInventario } from '../../domain/entities/ubicacion_inventario.entity.js';
import {
  type FiltrosUbicaciones,
  UbicacionesInventarioRepositorio,
} from '../../domain/repositories/ubicaciones_inventario.repository.js';

export class UbicacionesMemoria extends UbicacionesInventarioRepositorio {
  readonly ubicaciones = new Map<string, UbicacionInventario>();

  buscarPorId(id: string): Promise<UbicacionInventario | null> {
    return Promise.resolve(this.ubicaciones.get(id) ?? null);
  }

  buscarDeAmbulancia(
    ambulanciaId: string,
  ): Promise<UbicacionInventario | null> {
    return Promise.resolve(
      [...this.ubicaciones.values()].find(
        (u) => u.ambulanciaId === ambulanciaId,
      ) ?? null,
    );
  }

  async asegurarDeAmbulancia(
    ubicacion: UbicacionInventario,
  ): Promise<{ ubicacion: UbicacionInventario; creada: boolean }> {
    const existente = await this.buscarDeAmbulancia(
      ubicacion.ambulanciaId ?? '',
    );
    if (existente) return { ubicacion: existente, creada: false };
    this.ubicaciones.set(ubicacion.id, ubicacion);
    return { ubicacion, creada: true };
  }

  listar(filtros: FiltrosUbicaciones): Promise<UbicacionInventario[]> {
    return Promise.resolve(
      [...this.ubicaciones.values()].filter(
        (u) =>
          (filtros.tipo === undefined || u.tipo === filtros.tipo) &&
          (filtros.activa === undefined || u.activa === filtros.activa),
      ),
    );
  }

  cambiarEstado(ubicacion: UbicacionInventario): Promise<UbicacionInventario> {
    this.ubicaciones.set(ubicacion.id, ubicacion);
    return Promise.resolve(ubicacion);
  }
}
