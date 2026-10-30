import { Logger } from '@nestjs/common';
import { FallaProveedorExterno } from '../../exceptions/falla_proveedor_externo.js';

export interface OpcionesClienteGeoapify {
  apiKey: string | null;
  tiempoEsperaMs: number;
}

const URL_API = 'https://api.geoapify.com/v1';
const PROVEEDOR = 'geoapify';

/** Una clave real de Geoapify es alfanumérica; una enmascarada trae `*`, `…` o está incompleta. */
const PATRON_CLAVE = /^[A-Za-z0-9]{20,}$/;

/**
 * HTTP común a todas las APIs de Geoapify (geocodificación, rutas): valida la
 * clave, aplica el tiempo de espera y traduce los errores a
 * `FallaProveedorExterno`. Devuelve el cuerpo sin interpretar (`unknown`):
 * cada adaptador valida la forma que espera.
 */
export class ClienteGeoapify {
  private readonly logger = new Logger(ClienteGeoapify.name);
  private readonly apiKey: string | null;

  constructor(private readonly opciones: OpcionesClienteGeoapify) {
    const clave = opciones.apiKey?.trim() || null;
    this.apiKey = clave && PATRON_CLAVE.test(clave) ? clave : null;
    if (clave && !this.apiKey) {
      this.logger.warn(
        'GEOAPIFY_API_KEY parece enmascarada o incompleta; Geoapify queda deshabilitado',
      );
    }
  }

  estaConfigurado(): boolean {
    return this.apiKey !== null;
  }

  async obtener(ruta: string, parametros: URLSearchParams): Promise<unknown> {
    if (!this.apiKey) {
      throw this.falla('credenciales_invalidas', 'Sin API key');
    }
    parametros.set('apiKey', this.apiKey);

    // La URL lleva la API key: nunca se registra en el log.
    let respuesta: Response;
    try {
      respuesta = await fetch(`${URL_API}/${ruta}?${parametros.toString()}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(this.opciones.tiempoEsperaMs),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw this.falla(
          'tiempo_agotado',
          `Sin respuesta en ${this.opciones.tiempoEsperaMs} ms`,
        );
      }
      throw this.falla('no_disponible', 'No se pudo conectar con Geoapify');
    }

    if (respuesta.status === 401 || respuesta.status === 403) {
      throw this.falla('credenciales_invalidas', `HTTP ${respuesta.status}`);
    }
    if (respuesta.status === 429) {
      throw this.falla('limite_excedido', 'Límite de consumo alcanzado');
    }
    if (respuesta.status >= 500) {
      throw this.falla('no_disponible', `HTTP ${respuesta.status}`);
    }
    if (!respuesta.ok) {
      throw this.falla('respuesta_invalida', `HTTP ${respuesta.status}`);
    }

    try {
      return (await respuesta.json()) as unknown;
    } catch {
      throw this.falla('respuesta_invalida', 'El cuerpo no es JSON');
    }
  }

  falla(
    motivo: FallaProveedorExterno['motivo'],
    mensaje: string,
  ): FallaProveedorExterno {
    return new FallaProveedorExterno(PROVEEDOR, motivo, mensaje);
  }
}

export function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

export function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null;
}
