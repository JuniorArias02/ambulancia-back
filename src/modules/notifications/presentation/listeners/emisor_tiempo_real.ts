import type {
  DatosEventosServidor,
  EventoServidor,
} from '../dto/eventos_tiempo_real.dto.js';

/** Salida del notificador; la implementación decide cómo llega al servidor de tiempo real. */
export abstract class EmisorTiempoReal {
  /** Nunca lanza ni espera la entrega. */
  abstract emitir<E extends EventoServidor>(
    salas: string | string[],
    tipo: E,
    datos: DatosEventosServidor[E],
  ): void;
}
