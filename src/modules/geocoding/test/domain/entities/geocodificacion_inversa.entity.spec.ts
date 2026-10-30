import { GeocodificacionInversa } from '../../../domain/entities/geocodificacion_inversa.entity.js';
import { LUGAR_PRUEBA } from '../../dobles/geocodificacion_memoria.js';

describe('GeocodificacionInversa', () => {
  const punto = { latitud: 4.6855194, longitud: -74.0528512 };
  const datos = {
    clavePunto: GeocodificacionInversa.clavePunto(punto),
    puntoSolicitado: punto,
    proveedor: 'geoapify',
    fecha: new Date(),
  };

  it('redondea el punto a 5 decimales (~1 m) para la clave', () => {
    expect(datos.clavePunto).toBe('4.68552|-74.05285');
  });

  it('guarda la dirección completa cuando la precisión no es de zona', () => {
    const geocodificacion = GeocodificacionInversa.encontrada({
      ...datos,
      lugar: LUGAR_PRUEBA,
      precision: 'exacta',
    });

    expect(geocodificacion.lineaDireccion).toBe('Cl 100 19 61');
    expect(geocodificacion.componentes.numero).toBe('19 61');
    expect(geocodificacion.coordenadasDireccion).toEqual(
      LUGAR_PRUEBA.coordenadas,
    );
  });

  it('en zona no atribuye al punto el nombre, la calle ni la placa de un lugar lejano', () => {
    const geocodificacion = GeocodificacionInversa.encontrada({
      ...datos,
      lugar: {
        ...LUGAR_PRUEBA,
        direccionFormateada: 'Sede escuela rural Alto Charco, Sibaté, Colombia',
        distanciaMetros: 957.3,
      },
      precision: 'zona',
    });

    expect(geocodificacion.direccion).toBe('Chicó, Bogotá, Distrito Especial');
    expect(geocodificacion.lineaDireccion).toBeNull();
    expect(geocodificacion.componentes.calle).toBeNull();
    expect(geocodificacion.componentes.numero).toBeNull();
    expect(geocodificacion.coordenadasDireccion).toBeNull();
    expect(geocodificacion.distanciaMetros).toBe(957.3);
  });
});
