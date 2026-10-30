import type { EventoDominio } from '../../src/common/events/eventos_dominio.js';
import { PublicadorEventos } from '../../src/common/events/publicador_eventos.js';

/** Guarda lo publicado para verificar qué eventos emitió cada caso de uso. */
export class PublicadorEventosMemoria extends PublicadorEventos {
  readonly eventos: EventoDominio[] = [];

  publicar(...eventos: EventoDominio[]): void {
    this.eventos.push(...eventos);
  }

  suscribir(): void {}

  tipos(): string[] {
    return this.eventos.map((evento) => evento.tipo);
  }
}
