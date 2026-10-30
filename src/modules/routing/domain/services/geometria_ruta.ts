import {
  distanciaMetros,
  type PuntoGeografico,
} from '../../../../common/utils/geografia.js';

const METROS_POR_GRADO = 111_320;

/**
 * Distancia en metros del punto al tramo más cercano de la línea. Proyecta
 * localmente (equirrectangular): en distancias urbanas el error es mínimo y
 * no hace falta una librería de geometría.
 */
export function distanciaPuntoARuta(
  punto: PuntoGeografico,
  linea: readonly PuntoGeografico[],
): number {
  if (linea.length === 0) return Number.POSITIVE_INFINITY;
  if (linea.length === 1) return distanciaMetros(punto, linea[0]!);

  const escalaLongitud = Math.cos((punto.latitud * Math.PI) / 180);
  const aPlano = (p: PuntoGeografico) => ({
    x: (p.longitud - punto.longitud) * METROS_POR_GRADO * escalaLongitud,
    y: (p.latitud - punto.latitud) * METROS_POR_GRADO,
  });

  let minima = Number.POSITIVE_INFINITY;
  for (let i = 1; i < linea.length; i++) {
    const a = aPlano(linea[i - 1]!);
    const b = aPlano(linea[i]!);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const largo2 = dx * dx + dy * dy;
    // Proyección del punto (el origen del plano) sobre el segmento, acotada a sus extremos.
    const t =
      largo2 === 0
        ? 0
        : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / largo2));
    minima = Math.min(minima, Math.hypot(a.x + t * dx, a.y + t * dy));
  }
  return minima;
}
