import { clasificarPrecision } from '../../../domain/services/precision_ubicacion.js';
import { LUGAR_PRUEBA } from '../../dobles/geocodificacion_memoria.js';

describe('clasificarPrecision', () => {
  const MAXIMO_CALLE = 100;

  it('exacta: hay placa y el lugar está prácticamente en el punto', () => {
    expect(clasificarPrecision(LUGAR_PRUEBA, MAXIMO_CALLE)).toBe('exacta');
  });

  it('aproximada: la placa está lejos o no se conoce, pero la calle está cerca', () => {
    expect(
      clasificarPrecision(
        { ...LUGAR_PRUEBA, distanciaMetros: 60 },
        MAXIMO_CALLE,
      ),
    ).toBe('aproximada');
    expect(
      clasificarPrecision(
        {
          ...LUGAR_PRUEBA,
          componentes: { ...LUGAR_PRUEBA.componentes, numero: null },
        },
        MAXIMO_CALLE,
      ),
    ).toBe('aproximada');
  });

  it('zona: lo más cercano está lejos (caso rural de la prueba real, a 957 m)', () => {
    expect(
      clasificarPrecision(
        { ...LUGAR_PRUEBA, distanciaMetros: 957 },
        MAXIMO_CALLE,
      ),
    ).toBe('zona');
  });

  it('null si no hay ni calle cercana ni municipio', () => {
    expect(
      clasificarPrecision(
        {
          ...LUGAR_PRUEBA,
          distanciaMetros: 957,
          componentes: {
            ...LUGAR_PRUEBA.componentes,
            ciudad: null,
            departamento: null,
          },
        },
        MAXIMO_CALLE,
      ),
    ).toBeNull();
  });
});
