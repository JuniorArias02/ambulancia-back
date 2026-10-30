export interface PuntoGeografico {
  latitud: number;
  longitud: number;
}

const RADIO_TIERRA_METROS = 6_371_000;

/** Distancia en línea recta entre dos puntos (fórmula de haversine). */
export function distanciaMetros(
  a: PuntoGeografico,
  b: PuntoGeografico,
): number {
  const radianes = (grados: number) => (grados * Math.PI) / 180;
  const dLat = radianes(b.latitud - a.latitud);
  const dLon = radianes(b.longitud - a.longitud);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radianes(a.latitud)) *
      Math.cos(radianes(b.latitud)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA_METROS * Math.asin(Math.sqrt(h));
}
