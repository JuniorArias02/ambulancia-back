import type { LugarEncontrado } from './proveedor_geocodificacion.js';

/**
 * Qué tanto se le puede creer a la dirección de un punto del mapa:
 * - `exacta`: hay placa y el lugar está prácticamente en el punto.
 * - `aproximada`: se conoce la calle, pero no la placa exacta.
 * - `zona`: solo se sabe el barrio o el municipio (típico en zona rural).
 */
export const PRECISIONES_UBICACION = ['exacta', 'aproximada', 'zona'] as const;
export type PrecisionUbicacion = (typeof PRECISIONES_UBICACION)[number];

/** Más lejos que esto, la placa ya puede ser la del vecino. */
export const DISTANCIA_MAXIMA_EXACTA_METROS = 25;

/** null si no hay nada útil: ni calle cercana ni municipio. */
export function clasificarPrecision(
  lugar: LugarEncontrado,
  distanciaMaximaCalleMetros: number,
): PrecisionUbicacion | null {
  const { calle, numero, ciudad, departamento } = lugar.componentes;
  if (
    calle &&
    numero &&
    lugar.distanciaMetros <= DISTANCIA_MAXIMA_EXACTA_METROS
  ) {
    return 'exacta';
  }
  if (calle && lugar.distanciaMetros <= distanciaMaximaCalleMetros) {
    return 'aproximada';
  }
  if (ciudad || departamento) return 'zona';
  return null;
}
