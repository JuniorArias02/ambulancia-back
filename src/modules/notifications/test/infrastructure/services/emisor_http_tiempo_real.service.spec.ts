import { ConfigService } from '@nestjs/config';
import type { VariablesEntorno } from '../../../../../config/variables_entorno.js';
import { EmisorHttpTiempoReal } from '../../../infrastructure/services/emisor_http_tiempo_real.service.js';

const CLAVE = 'clave-interna-de-prueba-con-32-caracteres';

function crearEmisor(
  variables: Partial<VariablesEntorno> = {
    TIEMPO_REAL_URL: 'http://tiempo-real:3001/',
    TIEMPO_REAL_CLAVE_INTERNA: CLAVE,
  },
): EmisorHttpTiempoReal {
  return new EmisorHttpTiempoReal(
    new ConfigService<VariablesEntorno, true>(variables),
  );
}

const ambulancia = {
  ambulancia: {
    id: 'amb-1',
    codigo: 'AMB-01',
    placa: 'ABC123',
    tipo: { id: 't1', nombre: 'TAB', descripcion: null },
    estadoOperativo: 'disponible' as const,
    ultimaUbicacion: null,
    creadaEn: new Date(),
  },
};

function respuesta(status: number): Response {
  return new Response(null, { status });
}

describe('EmisorHttpTiempoReal', () => {
  let fetchFalso: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchFalso = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchFalso);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function cuerpoDe(llamada: number): Record<string, unknown> {
    const [, opciones] = fetchFalso.mock.calls[llamada] ?? [];
    const cuerpo = opciones?.body;
    if (typeof cuerpo !== 'string')
      throw new Error('Se esperaba un cuerpo JSON');
    return JSON.parse(cuerpo) as Record<string, unknown>;
  }

  it('envía el evento y sus salas con la clave interna', async () => {
    fetchFalso.mockResolvedValue(respuesta(202));

    crearEmisor().emitir('central', 'ambulancia.actualizada', ambulancia);
    await vi.runAllTimersAsync();

    const [url, opciones] = fetchFalso.mock.calls[0] ?? [];
    expect(url).toBe('http://tiempo-real:3001/interno/eventos');
    expect(opciones?.headers).toEqual(
      expect.objectContaining({ 'x-clave-interna': CLAVE }),
    );
    expect(cuerpoDe(0)).toEqual(
      expect.objectContaining({
        tipo: 'ambulancia.actualizada',
        salas: ['central'],
      }),
    );
  });

  it('reintenta los fallos del servidor con el mismo id', async () => {
    fetchFalso
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(respuesta(503))
      .mockResolvedValueOnce(respuesta(202));

    crearEmisor().emitir('central', 'ambulancia.actualizada', ambulancia);
    await vi.runAllTimersAsync();

    expect(fetchFalso).toHaveBeenCalledTimes(3);
    expect(cuerpoDe(2).id).toBe(cuerpoDe(0).id);
  });

  it('se rinde después de agotar los reintentos', async () => {
    fetchFalso.mockResolvedValue(respuesta(500));

    crearEmisor().emitir('central', 'ambulancia.actualizada', ambulancia);
    await vi.runAllTimersAsync();

    expect(fetchFalso).toHaveBeenCalledTimes(4);
  });

  it('no reintenta si el servidor rechaza la clave', async () => {
    fetchFalso.mockResolvedValue(respuesta(401));

    crearEmisor().emitir('central', 'ambulancia.actualizada', ambulancia);
    await vi.runAllTimersAsync();

    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it('no reintenta ubicaciones: la siguiente es más nueva', async () => {
    fetchFalso.mockResolvedValue(respuesta(503));

    crearEmisor().emitir('central', 'ambulancia.ubicacion_actualizada', {
      ambulanciaId: 'amb-1',
      asignacionId: null,
      latitud: 4.65,
      longitud: -74.05,
      velocidad: null,
      registradaEn: new Date(),
    });
    await vi.runAllTimersAsync();

    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it('no envía nada si el tiempo real no está configurado', async () => {
    crearEmisor({}).emitir('central', 'ambulancia.actualizada', ambulancia);
    await vi.runAllTimersAsync();

    expect(fetchFalso).not.toHaveBeenCalled();
  });
});
