import {
  INTERVALO_MINIMO_UBICACION_MS,
  LimitadorUbicaciones,
} from '../../../application/services/limitador_ubicaciones.js';

describe('LimitadorUbicaciones', () => {
  it('descarta las ubicaciones de la misma ambulancia dentro del intervalo', () => {
    const limitador = new LimitadorUbicaciones();

    expect(limitador.permite('amb-1', 0)).toBe(true);
    expect(limitador.permite('amb-1', INTERVALO_MINIMO_UBICACION_MS - 1)).toBe(
      false,
    );
    expect(limitador.permite('amb-1', INTERVALO_MINIMO_UBICACION_MS)).toBe(
      true,
    );
  });

  it('no mezcla ambulancias distintas', () => {
    const limitador = new LimitadorUbicaciones();

    expect(limitador.permite('amb-1', 0)).toBe(true);
    expect(limitador.permite('amb-2', 1)).toBe(true);
  });
});
