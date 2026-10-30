import { FallaProveedorExterno } from '../../../../../common/exceptions/falla_proveedor_externo.js';
import { ClienteGeoapify } from '../../../../../common/integrations/geoapify/cliente_geoapify.js';
import { GeoapifyRutasProveedor } from '../../../infrastructure/services/geoapify_rutas_proveedor.service.js';

const ORIGEN = { latitud: 7.8939, longitud: -72.5078 };
const DESTINO = { latitud: 7.907, longitud: -72.497 };

function proveedor(apiKey: string | null = 'c4e9f0adbb4145698972481f748cb293') {
  return new GeoapifyRutasProveedor(
    new ClienteGeoapify({ apiKey, tiempoEsperaMs: 1000 }),
  );
}

function responder(estado: number, cuerpo: unknown) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      new Response(JSON.stringify(cuerpo), { status: estado }),
    );
}

describe('GeoapifyRutasProveedor', () => {
  afterEach(() => vi.restoreAllMocks());

  it('pide la ruta en carro y une los tramos de la geometría (forma real de Geoapify)', async () => {
    const fetch = responder(200, {
      results: [
        {
          distance: 2532,
          time: 229.224,
          geometry: [
            [
              { lon: -72.507726, lat: 7.893516 },
              { lon: -72.507272, lat: 7.893602 },
            ],
            [{ lon: -72.497, lat: 7.907 }],
          ],
        },
      ],
    });

    const ruta = await proveedor().calcular(ORIGEN, DESTINO);

    expect(ruta).toEqual({
      geometria: [
        { latitud: 7.893516, longitud: -72.507726 },
        { latitud: 7.893602, longitud: -72.507272 },
        { latitud: 7.907, longitud: -72.497 },
      ],
      distanciaMetros: 2532,
      duracionSegundos: 229.224,
    });
    const destino = fetch.mock.calls[0]?.[0];
    const url = new URL(typeof destino === 'string' ? destino : '');
    expect(url.pathname).toBe('/v1/routing');
    expect(url.searchParams.get('waypoints')).toBe(
      '7.8939,-72.5078|7.907,-72.497',
    );
    expect(url.searchParams.get('mode')).toBe('drive');
  });

  it('sin resultados no hay ruta', async () => {
    responder(200, { results: [] });
    expect(await proveedor().calcular(ORIGEN, DESTINO)).toBeNull();
  });

  it('traduce los errores HTTP con el cliente compartido', async () => {
    responder(429, {});
    await expect(proveedor().calcular(ORIGEN, DESTINO)).rejects.toBeInstanceOf(
      FallaProveedorExterno,
    );
  });

  it('sin clave queda sin configurar', () => {
    expect(proveedor(null).estaConfigurado()).toBe(false);
  });
});
