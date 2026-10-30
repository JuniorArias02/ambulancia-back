import {
  ClienteGeoapify,
  esObjeto,
} from '../../../../common/integrations/geoapify/cliente_geoapify.js';
import type { PuntoGeografico } from '../../../../common/utils/geografia.js';
import {
  ProveedorRutas,
  type RutaCalculada,
} from '../../domain/services/proveedor_rutas.js';

/** Routing API de Geoapify (`/v1/routing`, `format=json`). */
export class GeoapifyRutasProveedor extends ProveedorRutas {
  readonly nombre = 'geoapify';

  constructor(private readonly cliente: ClienteGeoapify) {
    super();
  }

  estaConfigurado(): boolean {
    return this.cliente.estaConfigurado();
  }

  async calcular(
    origen: PuntoGeografico,
    destino: PuntoGeografico,
  ): Promise<RutaCalculada | null> {
    const cuerpo = await this.cliente.obtener(
      'routing',
      new URLSearchParams({
        waypoints: `${origen.latitud},${origen.longitud}|${destino.latitud},${destino.longitud}`,
        mode: 'drive',
        format: 'json',
      }),
    );
    if (!esObjeto(cuerpo) || !Array.isArray(cuerpo['results'])) {
      throw this.cliente.falla('respuesta_invalida', 'Falta "results"');
    }
    const resultado: unknown = cuerpo['results'][0];
    if (!esObjeto(resultado)) return null;

    const { distance, time, geometry } = resultado;
    if (typeof distance !== 'number' || typeof time !== 'number') {
      throw this.cliente.falla('respuesta_invalida', 'Sin distancia o tiempo');
    }
    return {
      geometria: this.leerGeometria(geometry),
      distanciaMetros: distance,
      duracionSegundos: time,
    };
  }

  /** `geometry` llega por tramos (uno por par de puntos): [[{lat, lon}, …], …]. */
  private leerGeometria(geometria: unknown): PuntoGeografico[] {
    if (!Array.isArray(geometria)) return [];
    return geometria.flatMap((tramo: unknown) =>
      Array.isArray(tramo)
        ? tramo.flatMap((punto: unknown) =>
            esObjeto(punto) &&
            typeof punto['lat'] === 'number' &&
            typeof punto['lon'] === 'number'
              ? [{ latitud: punto['lat'], longitud: punto['lon'] }]
              : [],
          )
        : [],
    );
  }
}
