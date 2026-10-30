import { FallaProveedorGeocodificacion } from '../../../domain/services/proveedor_geocodificacion.js';
import {
  GeoapifyProveedor,
  type OpcionesGeoapify,
} from '../../../infrastructure/services/geoapify_proveedor.service.js';

const CLAVE = 'c4e9f0adbb4145698972481f748cb293';
const CONSULTA = { direccion: 'Calle 72 # 15-20', ciudad: 'Bogotá' };

function proveedor(opciones: Partial<OpcionesGeoapify> = {}) {
  return new GeoapifyProveedor({
    apiKey: CLAVE,
    pais: 'co',
    confianzaMinima: 0.6,
    tiempoEsperaMs: 1000,
    ...opciones,
  });
}

function responder(estado: number, cuerpo: unknown) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      new Response(JSON.stringify(cuerpo), { status: estado }),
    );
}

function resultado(cambios: Record<string, unknown> = {}) {
  return {
    lat: 4.6573,
    lon: -74.0601,
    formatted: 'Calle 72 #15-20, Bogotá, Colombia',
    place_id: 'abc123',
    result_type: 'building',
    country_code: 'co',
    rank: { confidence: 0.95 },
    ...cambios,
  };
}

async function motivoDeFalla(promesa: Promise<unknown>): Promise<string> {
  try {
    await promesa;
  } catch (error) {
    if (error instanceof FallaProveedorGeocodificacion) return error.motivo;
    throw error;
  }
  throw new Error('Se esperaba una falla');
}

describe('GeoapifyProveedor', () => {
  afterEach(() => vi.restoreAllMocks());

  it('devuelve las coordenadas y arma la consulta restringida al país', async () => {
    const fetch = responder(200, { results: [resultado()] });

    const respuesta = await proveedor().geocodificar(CONSULTA);

    expect(respuesta).toEqual({
      candidatos: [
        {
          latitud: 4.6573,
          longitud: -74.0601,
          direccionFormateada: 'Calle 72 #15-20, Bogotá, Colombia',
          proveedorResultadoId: 'abc123',
          confianza: 0.95,
        },
      ],
    });
    const destino = fetch.mock.calls[0]?.[0];
    const url = new URL(typeof destino === 'string' ? destino : '');
    // Sin "#": con el símbolo, Geoapify solo encuentra la calle.
    expect(url.searchParams.get('text')).toBe('Calle 72 15-20, Bogotá');
    expect(url.searchParams.get('filter')).toBe('countrycode:co');
    expect(url.searchParams.get('apiKey')).toBe(CLAVE);
  });

  it('descarta resultados poco confiables en vez de devolverlos', async () => {
    responder(200, { results: [resultado({ rank: { confidence: 0.3 } })] });
    expect(await proveedor().geocodificar(CONSULTA)).toEqual({
      candidatos: [],
    });
  });

  it('descarta resultados que solo ubican la ciudad o el barrio', async () => {
    responder(200, { results: [resultado({ result_type: 'city' })] });
    expect(await proveedor().geocodificar(CONSULTA)).toEqual({
      candidatos: [],
    });
  });

  it('descarta resultados de otro país', async () => {
    responder(200, { results: [resultado({ country_code: 've' })] });
    expect(await proveedor().geocodificar(CONSULTA)).toEqual({
      candidatos: [],
    });
  });

  it('sin resultados es "no encontrada"', async () => {
    responder(200, { results: [] });
    expect(await proveedor().geocodificar(CONSULTA)).toEqual({
      candidatos: [],
    });
  });

  it('traduce los errores HTTP a motivos de falla', async () => {
    responder(401, { error: 'Unauthorized' });
    expect(await motivoDeFalla(proveedor().geocodificar(CONSULTA))).toBe(
      'credenciales_invalidas',
    );
    vi.restoreAllMocks();

    responder(429, { error: 'Too Many Requests' });
    expect(await motivoDeFalla(proveedor().geocodificar(CONSULTA))).toBe(
      'limite_excedido',
    );
    vi.restoreAllMocks();

    responder(503, {});
    expect(await motivoDeFalla(proveedor().geocodificar(CONSULTA))).toBe(
      'no_disponible',
    );
  });

  it('una respuesta con forma inesperada es inválida', async () => {
    responder(200, { features: [] });
    expect(await motivoDeFalla(proveedor().geocodificar(CONSULTA))).toBe(
      'respuesta_invalida',
    );
  });

  it('el tiempo de espera agotado se informa como tal', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new DOMException('The operation timed out.', 'TimeoutError'),
    );
    expect(await motivoDeFalla(proveedor().geocodificar(CONSULTA))).toBe(
      'tiempo_agotado',
    );
  });

  it('una clave vacía, enmascarada o incompleta deja el proveedor sin configurar', () => {
    expect(proveedor({ apiKey: null }).estaConfigurado()).toBe(false);
    expect(
      proveedor({
        apiKey: 'c4e9f0ad************************',
      }).estaConfigurado(),
    ).toBe(false);
    expect(proveedor({ apiKey: 'c4e9f0' }).estaConfigurado()).toBe(false);
    expect(proveedor().estaConfigurado()).toBe(true);
  });

  describe('geocodificarInverso', () => {
    const punto = { latitud: 4.6573, longitud: -74.0601 };
    const cercano = {
      lat: 4.65732,
      lon: -74.06008,
      formatted: 'Kr 12 71 40, 110221 Bogotá, DC, Colombia',
      address_line1: 'Kr 12 71 40',
      street: 'Kr 12',
      housenumber: '71 40',
      suburb: 'Quinta Camacho',
      city: 'Bogotá',
      state: 'Distrito Especial',
      postcode: '110221',
      country_code: 'co',
      result_type: 'building',
      place_id: 'xyz789',
    };

    it('consulta /reverse y devuelve el lugar con sus componentes y la distancia calculada', async () => {
      const fetch = responder(200, { results: [cercano] });

      const { lugar } = await proveedor().geocodificarInverso(punto);

      const destino = fetch.mock.calls[0]?.[0];
      const url = new URL(typeof destino === 'string' ? destino : '');
      expect(url.pathname).toBe('/v1/geocode/reverse');
      expect(url.searchParams.get('lat')).toBe('4.6573');
      expect(lugar?.lineaDireccion).toBe('Kr 12 71 40');
      expect(lugar?.componentes).toEqual({
        calle: 'Kr 12',
        numero: '71 40',
        barrio: 'Quinta Camacho',
        ciudad: 'Bogotá',
        departamento: 'Distrito Especial',
        codigoPostal: '110221',
        pais: 'co',
      });
      expect(lugar?.distanciaMetros).toBeGreaterThan(2);
      expect(lugar?.distanciaMetros).toBeLessThan(4);
    });

    it('un punto fuera del país no tiene lugar', async () => {
      responder(200, { results: [{ ...cercano, country_code: 've' }] });
      expect(await proveedor().geocodificarInverso(punto)).toEqual({
        lugar: null,
      });
    });

    it('sin resultados no hay lugar', async () => {
      responder(200, { results: [] });
      expect(await proveedor().geocodificarInverso(punto)).toEqual({
        lugar: null,
      });
    });

    it('comparte la traducción de errores con la búsqueda', async () => {
      responder(429, {});
      expect(await motivoDeFalla(proveedor().geocodificarInverso(punto))).toBe(
        'limite_excedido',
      );
    });
  });
});
