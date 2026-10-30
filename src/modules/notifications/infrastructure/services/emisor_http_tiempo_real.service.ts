import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CABECERA_CLAVE_INTERNA } from '../../../../common/guards/clave_interna.guard.js';
import type { VariablesEntorno } from '../../../../config/variables_entorno.js';
import type {
  DatosEventosServidor,
  EnvioTiempoReal,
  EventoServidor,
} from '../../presentation/dto/eventos_tiempo_real.dto.js';
import { EmisorTiempoReal } from '../../presentation/listeners/emisor_tiempo_real.js';

/** Espera antes de cada reintento: cubre un reinicio corto del servidor de tiempo real. */
export const RETRASOS_REINTENTO_MS: readonly number[] = [1_000, 3_000, 10_000];

const TIEMPO_ESPERA_MS = 5_000;

/** Si el servidor de tiempo real queda caído, no se acumula memoria sin límite. */
export const MAXIMO_ENVIOS_PENDIENTES = 500;

/** Una posición vieja no sirve: la siguiente ya trae una más nueva. */
const EVENTOS_SIN_REINTENTO: ReadonlySet<EventoServidor> = new Set([
  'ambulancia.ubicacion_actualizada',
]);

class EntregaFallida extends Error {
  constructor(
    mensaje: string,
    readonly reintentable: boolean,
  ) {
    super(mensaje);
  }
}

interface Destino {
  url: string;
  clave: string;
}

/**
 * Entrega cada evento al servidor `webSocket/` por HTTP interno. El `id` no
 * cambia entre reintentos: ese servidor descarta lo que ya había entregado.
 */
@Injectable()
export class EmisorHttpTiempoReal extends EmisorTiempoReal {
  private readonly logger = new Logger(EmisorHttpTiempoReal.name);
  private readonly destino: Destino | null;
  private pendientes = 0;

  constructor(configuracion: ConfigService<VariablesEntorno, true>) {
    super();
    const url = configuracion.get('TIEMPO_REAL_URL', { infer: true });
    const clave = configuracion.get('TIEMPO_REAL_CLAVE_INTERNA', {
      infer: true,
    });
    this.destino =
      url && clave
        ? { url: `${url.replace(/\/+$/, '')}/interno/eventos`, clave }
        : null;
    if (!this.destino) {
      this.logger.warn(
        'Tiempo real deshabilitado: faltan TIEMPO_REAL_URL o TIEMPO_REAL_CLAVE_INTERNA',
      );
    }
  }

  emitir<E extends EventoServidor>(
    salas: string | string[],
    tipo: E,
    datos: DatosEventosServidor[E],
  ): void {
    if (!this.destino) return;
    if (this.pendientes >= MAXIMO_ENVIOS_PENDIENTES) {
      this.logger.error(`Se descarta ${tipo}: demasiados envíos pendientes`);
      return;
    }

    const envio: EnvioTiempoReal<E> = {
      id: randomUUID(),
      tipo,
      ocurridoEn: new Date().toISOString(),
      salas: [salas].flat(),
      datos,
    };
    this.pendientes++;
    void this.entregar(envio, this.destino).finally(() => this.pendientes--);
  }

  /** Nunca rechaza: si se agotan los intentos, solo queda en el log. */
  private async entregar(
    envio: EnvioTiempoReal,
    destino: Destino,
  ): Promise<void> {
    const retrasos = EVENTOS_SIN_REINTENTO.has(envio.tipo)
      ? []
      : RETRASOS_REINTENTO_MS;

    for (let intento = 0; ; intento++) {
      try {
        await this.enviar(envio, destino);
        return;
      } catch (error) {
        const retraso = retrasos[intento];
        const reintentable =
          !(error instanceof EntregaFallida) || error.reintentable;
        if (!reintentable || retraso === undefined) {
          // Sin datos del evento: pueden ser personales o clínicos.
          this.logger.error(
            `No se entregó ${envio.tipo} (${envio.id}) tras ${intento + 1} intento(s): ${causaDe(error)}`,
          );
          return;
        }
        await esperar(retraso);
      }
    }
  }

  private async enviar(
    envio: EnvioTiempoReal,
    destino: Destino,
  ): Promise<void> {
    const respuesta = await fetch(destino.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [CABECERA_CLAVE_INTERNA]: destino.clave,
      },
      body: JSON.stringify(envio),
      signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
    });
    if (respuesta.ok) return;

    // Clave o contrato inválidos (4xx) no se arreglan reintentando; 429 y 5xx sí.
    throw new EntregaFallida(
      `el servidor respondió ${respuesta.status}`,
      respuesta.status === 429 || respuesta.status >= 500,
    );
  }
}

function esperar(milisegundos: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, milisegundos));
}

function causaDe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
