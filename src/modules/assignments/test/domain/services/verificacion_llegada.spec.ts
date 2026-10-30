import { verificarLlegada } from '../../../domain/services/verificacion_llegada.js';

describe('verificarLlegada', () => {
  const escena = { latitud: 7.907, longitud: -72.497 };

  it('dentro del radio', () => {
    expect(
      verificarLlegada({ latitud: 7.90745, longitud: -72.497 }, escena, 100),
    ).toEqual({
      distanciaMetros: 50,
      dentroDelRadio: true,
    });
  });

  it('fuera del radio informa la distancia', () => {
    const resultado = verificarLlegada(
      { latitud: 7.916, longitud: -72.497 },
      escena,
      100,
    );
    expect(resultado.dentroDelRadio).toBe(false);
    expect(resultado.distanciaMetros).toBeCloseTo(1000.8, 0);
  });

  it('sin coordenadas de la emergencia no hay contra qué comparar', () => {
    expect(verificarLlegada(escena, null, 100)).toEqual({
      distanciaMetros: null,
      dentroDelRadio: true,
    });
  });
});
