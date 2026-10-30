import type { GeocodificacionInversa } from '../entities/geocodificacion_inversa.entity.js';

export abstract class GeocodificacionesInversasRepositorio {
  abstract buscarPorClave(
    clavePunto: string,
  ): Promise<GeocodificacionInversa | null>;
  /** Inserta o, si el punto ya existe (reintento de una no encontrada), actualiza esa fila. */
  abstract guardar(
    geocodificacion: GeocodificacionInversa,
  ): Promise<GeocodificacionInversa>;
}
