import { ReglaNegocioError } from '../../../../../common/exceptions/errores_dominio.js';
import { GeocodificarCoordenadas } from '../../../application/use-cases/geocodificar_coordenadas.use-case.js';
import { FallaProveedorGeocodificacion } from '../../../domain/services/proveedor_geocodificacion.js';
import {
  CONFIGURACION_PRUEBA,
  consultorCon,
  GeocodificacionesInversasMemoria,
  LUGAR_PRUEBA,
  ProveedorFalso,
} from '../../dobles/geocodificacion_memoria.js';

describe('GeocodificarCoordenadas', () => {
  const punto = { latitud: 4.685519, longitud: -74.052851 };
  let repositorio: GeocodificacionesInversasMemoria;
  let geoapify: ProveedorFalso;

  function crearCasoDeUso(proveedores = [geoapify]) {
    return new GeocodificarCoordenadas(
      repositorio,
      consultorCon(proveedores),
      CONFIGURACION_PRUEBA,
    );
  }

  beforeEach(() => {
    repositorio = new GeocodificacionesInversasMemoria();
    geoapify = new ProveedorFalso('geoapify');
    geoapify.respuestaInversa = () => Promise.resolve({ lugar: LUGAR_PRUEBA });
  });

  it('consulta al proveedor, clasifica la precisión y guarda el resultado', async () => {
    const { geocodificacion, origen } = await crearCasoDeUso().ejecutar(punto);

    expect(origen).toBe('proveedor');
    expect(geocodificacion.precision).toBe('exacta');
    expect(geocodificacion.lineaDireccion).toBe('Cl 100 19 61');
    expect(geocodificacion.proveedor).toBe('geoapify');
    expect(repositorio.geocodificaciones.has('4.68552|-74.05285')).toBe(true);
  });

  it('reutiliza un punto ya consultado (aunque el clic difiera en centímetros)', async () => {
    const caso = crearCasoDeUso();
    await caso.ejecutar(punto);

    const segunda = await caso.ejecutar({
      latitud: 4.6855192,
      longitud: -74.0528508,
    });

    expect(segunda.origen).toBe('almacenada');
    expect(geoapify.llamadasInversas).toHaveLength(1);
  });

  it('guarda como no encontrada si el proveedor no conoce nada en el punto', async () => {
    geoapify.respuestaInversa = () => Promise.resolve({ lugar: null });

    const { geocodificacion } = await crearCasoDeUso().ejecutar(punto);

    expect(geocodificacion.estado).toBe('no_encontrada');
    expect(geocodificacion.direccion).toBeNull();
  });

  it('usa el siguiente proveedor si el primero falla', async () => {
    geoapify.respuestaInversa = () =>
      Promise.reject(
        new FallaProveedorGeocodificacion('geoapify', 'no_disponible', '503'),
      );
    const respaldo = new ProveedorFalso('respaldo');
    respaldo.respuestaInversa = () => Promise.resolve({ lugar: LUGAR_PRUEBA });

    const { geocodificacion } = await crearCasoDeUso([
      geoapify,
      respaldo,
    ]).ejecutar(punto);

    expect(geocodificacion.proveedor).toBe('respaldo');
  });

  it('rechaza coordenadas inválidas sin consultar al proveedor', () => {
    expect(() =>
      crearCasoDeUso().ejecutar({ latitud: 0, longitud: 0 }),
    ).toThrow(ReglaNegocioError);
    expect(geoapify.llamadasInversas).toHaveLength(0);
  });
});
