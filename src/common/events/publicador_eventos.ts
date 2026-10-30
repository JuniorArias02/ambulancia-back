import type { EventoDominio } from './eventos_dominio.js';

export type SuscriptorEventos = (evento: EventoDominio) => Promise<void>;

/**
 * Los casos de uso publican aquí después de persistir y auditar, sin conocer
 * a los suscriptores (por ejemplo, el tiempo real).
 */
export abstract class PublicadorEventos {
  /** Nunca lanza ni espera a los suscriptores. */
  abstract publicar(...eventos: EventoDominio[]): void;
  abstract suscribir(suscriptor: SuscriptorEventos): void;
}
