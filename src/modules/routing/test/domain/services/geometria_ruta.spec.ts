import { distanciaPuntoARuta } from '../../../domain/services/geometria_ruta.js';

describe('distanciaPuntoARuta', () => {
  // Calle recta de oeste a este en Cúcuta.
  const linea = [
    { latitud: 7.9, longitud: -72.51 },
    { latitud: 7.9, longitud: -72.5 },
  ];

  it('sobre la ruta la distancia es casi cero', () => {
    expect(
      distanciaPuntoARuta({ latitud: 7.9, longitud: -72.505 }, linea),
    ).toBeLessThan(1);
  });

  it('mide la distancia perpendicular al tramo más cercano', () => {
    // 0.001° de latitud ≈ 111 m al norte de la calle.
    const distancia = distanciaPuntoARuta(
      { latitud: 7.901, longitud: -72.505 },
      linea,
    );
    expect(distancia).toBeGreaterThan(105);
    expect(distancia).toBeLessThan(117);
  });

  it('más allá del extremo, mide hasta ese extremo', () => {
    // 0.001° de longitud al este del final ≈ 110 m.
    const distancia = distanciaPuntoARuta(
      { latitud: 7.9, longitud: -72.499 },
      linea,
    );
    expect(distancia).toBeGreaterThan(105);
    expect(distancia).toBeLessThan(115);
  });

  it('una línea vacía está infinitamente lejos', () => {
    expect(distanciaPuntoARuta({ latitud: 7.9, longitud: -72.5 }, [])).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});
