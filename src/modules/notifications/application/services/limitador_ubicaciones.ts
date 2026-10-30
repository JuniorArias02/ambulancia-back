import { Injectable } from '@nestjs/common';

/** Suficiente para ver moverse la ambulancia en el mapa sin saturar el panel. */
export const INTERVALO_MINIMO_UBICACION_MS = 3_000;

/**
 * Deja pasar como máximo una ubicación por ambulancia en cada intervalo. Las
 * intermedias se descartan porque la siguiente trae una posición más nueva.
 */
@Injectable()
export class LimitadorUbicaciones {
  private readonly ultimaEmision = new Map<string, number>();

  permite(ambulanciaId: string, ahora: number = Date.now()): boolean {
    const ultima = this.ultimaEmision.get(ambulanciaId);
    if (
      ultima !== undefined &&
      ahora - ultima < INTERVALO_MINIMO_UBICACION_MS
    ) {
      return false;
    }
    this.ultimaEmision.set(ambulanciaId, ahora);
    return true;
  }
}
