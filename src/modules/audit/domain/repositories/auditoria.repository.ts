import type { EventoAuditoria } from '../entities/evento_auditoria.entity.js';

export abstract class AuditoriaRepositorio {
  abstract registrar(evento: EventoAuditoria): Promise<void>;
}
