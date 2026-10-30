import type { EstadoOperativo } from './ambulancia.entity.js';

/** Fila de estados_ambulancia_historial: quién cambió el estado, cuándo y por qué. */
export interface CambioEstadoAmbulancia {
  id: string;
  ambulanciaId: string;
  estadoAnterior: EstadoOperativo | null;
  estadoNuevo: EstadoOperativo;
  motivo: string | null;
  usuarioId: string | null;
  cambiadoEn: Date;
}
