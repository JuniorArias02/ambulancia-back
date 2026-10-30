import { crearRutaPrueba } from '../../../../../../test/dobles/rutas_memoria.js';

describe('RutaAsignacion', () => {
  it('la llegada estimada es el momento del cálculo más la duración', () => {
    const calculadaEn = new Date('2026-10-24T23:00:00Z');
    const ruta = crearRutaPrueba('a1', { calculadaEn });

    expect(ruta.llegadaEstimada().toISOString()).toBe(
      '2026-10-24T23:03:49.000Z',
    );
  });

  it('detecta el desvío según la tolerancia', () => {
    const ruta = crearRutaPrueba('a1');
    const cerca = { latitud: 7.9, longitud: -72.502 };
    const lejos = { latitud: 7.88, longitud: -72.53 };

    expect(ruta.estaDesviada(cerca, 150)).toBe(false);
    expect(ruta.estaDesviada(lejos, 150)).toBe(true);
  });

  it('no admite otro recálculo antes del intervalo mínimo', () => {
    const ruta = crearRutaPrueba('a1', {
      calculadaEn: new Date(Date.now() - 30_000),
    });

    expect(ruta.admiteRecalculo(new Date(), 60_000)).toBe(false);
    expect(ruta.admiteRecalculo(new Date(Date.now() + 31_000), 60_000)).toBe(
      true,
    );
  });
});
