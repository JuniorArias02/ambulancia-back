import { Injectable, Logger } from '@nestjs/common';
import type { EventoDominio } from './eventos_dominio.js';
import {
  PublicadorEventos,
  type SuscriptorEventos,
} from './publicador_eventos.js';

/**
 * Bus en memoria: basta mientras haya una sola instancia del backend. Si un
 * evento se pierde (fallo o caída del proceso), los clientes se recuperan
 * reconsultando el REST al reconectar.
 */
@Injectable()
export class BusEventos extends PublicadorEventos {
  private readonly logger = new Logger(BusEventos.name);
  private readonly suscriptores: SuscriptorEventos[] = [];

  publicar(...eventos: EventoDominio[]): void {
    for (const evento of eventos) {
      for (const suscriptor of this.suscriptores) {
        // Se difiere para que la respuesta HTTP no espere ni falle por un suscriptor.
        setImmediate(() => {
          Promise.resolve()
            .then(() => suscriptor(evento))
            .catch((error: unknown) => this.registrarFallo(evento, error));
        });
      }
    }
  }

  suscribir(suscriptor: SuscriptorEventos): void {
    this.suscriptores.push(suscriptor);
  }

  /** Solo el tipo y la causa: el evento puede llevar datos de la emergencia. */
  private registrarFallo(evento: EventoDominio, error: unknown): void {
    const causa = error instanceof Error ? error.message : String(error);
    this.logger.error(`No se pudo procesar ${evento.tipo}: ${causa}`);
  }
}
