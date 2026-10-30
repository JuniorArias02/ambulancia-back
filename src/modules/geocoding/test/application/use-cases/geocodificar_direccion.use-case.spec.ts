import { ServicioNoDisponibleError } from '../../../../../common/exceptions/errores_dominio.js';
import { GeocodificarDireccion } from '../../../application/use-cases/geocodificar_direccion.use-case.js';
import { DireccionGeocodificada } from '../../../domain/entities/direccion_geocodificada.entity.js';
import { FallaProveedorGeocodificacion } from '../../../domain/services/proveedor_geocodificacion.js';
import {
  CONFIGURACION_PRUEBA,
  consultorCon,
  DireccionesGeocodificadasMemoria,
  ProveedorFalso,
  UBICACION_PRUEBA,
} from '../../dobles/geocodificacion_memoria.js';

describe('GeocodificarDireccion', () => {
  let repositorio: DireccionesGeocodificadasMemoria;
  let geoapify: ProveedorFalso;

  function crearCasoDeUso(proveedores = [geoapify]) {
    return new GeocodificarDireccion(
      repositorio,
      consultorCon(proveedores),
      CONFIGURACION_PRUEBA,
    );
  }

  beforeEach(() => {
    repositorio = new DireccionesGeocodificadasMemoria();
    geoapify = new ProveedorFalso('geoapify');
    geoapify.respuesta = () =>
      Promise.resolve({ candidatos: [UBICACION_PRUEBA] });
  });

  it('consulta al proveedor, guarda el resultado y registra quién lo encontró', async () => {
    const { direccion, origen } = await crearCasoDeUso().ejecutar({
      direccion: 'Calle 72 # 15-20',
      ciudad: 'Bogotá',
    });

    expect(origen).toBe('proveedor');
    expect(direccion.proveedor).toBe('geoapify');
    expect(direccion.coordenadas).toEqual({
      latitud: 4.6573,
      longitud: -74.0601,
    });
    expect(repositorio.direcciones.has('co|bogota|calle 72 15 20')).toBe(true);
    expect(geoapify.llamadas).toEqual([
      { direccion: 'Calle 72 # 15-20', ciudad: 'Bogotá' },
    ]);
  });

  it('reutiliza lo guardado sin volver a consumir la API, aunque se escriba distinto', async () => {
    const caso = crearCasoDeUso();
    await caso.ejecutar({ direccion: 'Calle 72 # 15-20', ciudad: 'Bogotá' });

    const segunda = await caso.ejecutar({
      direccion: 'CL 72 No 15-20',
      ciudad: 'bogota',
    });

    expect(segunda.origen).toBe('almacenada');
    expect(geoapify.llamadas).toHaveLength(1);
  });

  it('guarda las no encontradas sin coordenadas y no repite la consulta', async () => {
    geoapify.respuesta = () => Promise.resolve({ candidatos: [] });
    const caso = crearCasoDeUso();

    const primera = await caso.ejecutar({ direccion: 'Calle inexistente 999' });
    const segunda = await caso.ejecutar({ direccion: 'Calle inexistente 999' });

    expect(primera.direccion.estado).toBe('no_encontrada');
    expect(primera.direccion.coordenadas).toBeNull();
    expect(segunda.origen).toBe('almacenada');
    expect(geoapify.llamadas).toHaveLength(1);
  });

  it('reintenta una no encontrada vieja', async () => {
    const vieja = DireccionGeocodificada.noEncontrada({
      direccionOriginal: 'Calle 1',
      direccionNormalizada: 'co|bogota|calle 1',
      ciudad: null,
      proveedor: 'geoapify',
      fecha: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    });
    await repositorio.guardar(vieja);

    const { direccion, origen } = await crearCasoDeUso().ejecutar({
      direccion: 'Calle 1',
    });

    expect(origen).toBe('proveedor');
    expect(direccion.estado).toBe('encontrada');
  });

  it('si el proveedor falla, no guarda nada y responde servicio no disponible', async () => {
    geoapify.respuesta = () =>
      Promise.reject(
        new FallaProveedorGeocodificacion(
          'geoapify',
          'tiempo_agotado',
          'timeout',
        ),
      );

    await expect(
      crearCasoDeUso().ejecutar({ direccion: 'Calle 72 # 15-20' }),
    ).rejects.toThrow(ServicioNoDisponibleError);
    expect(repositorio.direcciones.size).toBe(0);
  });

  it('usa el siguiente proveedor como respaldo cuando el primero falla', async () => {
    geoapify.respuesta = () =>
      Promise.reject(
        new FallaProveedorGeocodificacion('geoapify', 'limite_excedido', '429'),
      );
    const respaldo = new ProveedorFalso('respaldo');
    respaldo.respuesta = () =>
      Promise.resolve({ candidatos: [UBICACION_PRUEBA] });

    const { direccion } = await crearCasoDeUso([geoapify, respaldo]).ejecutar({
      direccion: 'Calle 72 # 15-20',
    });

    expect(direccion.proveedor).toBe('respaldo');
  });

  it('omite los proveedores sin configurar; si no queda ninguno, lo informa', async () => {
    const sinClave = new ProveedorFalso('geoapify', false);

    await expect(
      crearCasoDeUso([sinClave]).ejecutar({ direccion: 'Calle 72 # 15-20' }),
    ).rejects.toThrow('no está configurada');
    expect(sinClave.llamadas).toHaveLength(0);
  });

  it('no acepta coordenadas inválidas del proveedor', async () => {
    geoapify.respuesta = () =>
      Promise.resolve({
        candidatos: [{ ...UBICACION_PRUEBA, latitud: 0, longitud: 0 }],
      });

    const { direccion } = await crearCasoDeUso().ejecutar({
      direccion: 'Calle 72 # 15-20',
    });

    expect(direccion.estado).toBe('no_encontrada');
    expect(direccion.coordenadas).toBeNull();
  });

  it('descarta un candidato parecido pero distinto y toma el que sí coincide', async () => {
    geoapify.respuesta = () =>
      Promise.resolve({
        candidatos: [
          // Lo que Geoapify devolvió primero en la prueba real, con confianza 0.9.
          {
            ...UBICACION_PRUEBA,
            latitud: 4.51972,
            direccionFormateada:
              'Cl 72 S 15A 20 E, 110521 Bogotá, DC, Colombia',
          },
          UBICACION_PRUEBA,
        ],
      });

    const { direccion } = await crearCasoDeUso().ejecutar({
      direccion: 'Calle 72 # 15-20',
    });

    expect(direccion.coordenadas?.latitud).toBe(4.6573);
  });

  it('si ningún candidato es la dirección pedida, queda como no encontrada', async () => {
    geoapify.respuesta = () =>
      Promise.resolve({
        candidatos: [
          {
            ...UBICACION_PRUEBA,
            direccionFormateada: 'Cl 72 S 15A 20 E, Bogotá',
          },
        ],
      });

    const { direccion } = await crearCasoDeUso().ejecutar({
      direccion: 'Calle 72 # 15-20',
    });

    expect(direccion.estado).toBe('no_encontrada');
  });

  it('usa la ciudad predeterminada y, sin ella, exige la ciudad', async () => {
    await crearCasoDeUso().ejecutar({ direccion: 'Calle 72 # 15-20' });
    expect(geoapify.llamadas[0]?.ciudad).toBe('Bogotá');

    const sinCiudad = new GeocodificarDireccion(
      repositorio,
      consultorCon([geoapify]),
      { ...CONFIGURACION_PRUEBA, ciudadPredeterminada: null },
    );
    expect(() => sinCiudad.ejecutar({ direccion: 'Calle 10 # 5-20' })).toThrow(
      'Indique la ciudad',
    );
  });

  it('dos consultas simultáneas por la misma dirección llaman una sola vez al proveedor', async () => {
    const caso = crearCasoDeUso();

    const [a, b] = await Promise.all([
      caso.ejecutar({ direccion: 'Calle 72 # 15-20' }),
      caso.ejecutar({ direccion: 'calle 72 #15-20' }),
    ]);

    expect(geoapify.llamadas).toHaveLength(1);
    expect(a.direccion.id).toBe(b.direccion.id);
  });
});
