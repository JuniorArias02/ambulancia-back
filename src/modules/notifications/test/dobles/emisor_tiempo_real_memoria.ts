import type {
  DatosEventosServidor,
  EventoServidor,
} from '../../presentation/dto/eventos_tiempo_real.dto.js';
import { EmisorTiempoReal } from '../../presentation/listeners/emisor_tiempo_real.js';

export interface EmisionRegistrada {
  salas: string[];
  tipo: EventoServidor;
  datos: DatosEventosServidor[EventoServidor];
}

export class EmisorTiempoRealMemoria extends EmisorTiempoReal {
  readonly emisiones: EmisionRegistrada[] = [];

  emitir<E extends EventoServidor>(
    salas: string | string[],
    tipo: E,
    datos: DatosEventosServidor[E],
  ): void {
    this.emisiones.push({ salas: [salas].flat(), tipo, datos });
  }

  /** Tipos de evento que recibió una sala, en orden. */
  recibidosPor(sala: string): EventoServidor[] {
    return this.emisiones
      .filter((emision) => emision.salas.includes(sala))
      .map((emision) => emision.tipo);
  }
}
