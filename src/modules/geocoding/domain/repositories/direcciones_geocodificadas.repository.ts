import type { DireccionGeocodificada } from '../entities/direccion_geocodificada.entity.js';

export abstract class DireccionesGeocodificadasRepositorio {
  abstract buscarPorClave(
    direccionNormalizada: string,
  ): Promise<DireccionGeocodificada | null>;
  /**
   * Inserta o, si la clave ya existe (por ejemplo, un reintento de una no
   * encontrada), actualiza esa misma fila.
   */
  abstract guardar(
    direccion: DireccionGeocodificada,
  ): Promise<DireccionGeocodificada>;
}
