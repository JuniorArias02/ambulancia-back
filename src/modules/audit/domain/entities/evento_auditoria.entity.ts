export type ValorDetalleAuditoria =
  | string
  | number
  | boolean
  | null
  | ValorDetalleAuditoria[]
  | { [clave: string]: ValorDetalleAuditoria };

/** Registro de una operación sensible. El detalle no debe incluir secretos ni datos clínicos. */
export interface EventoAuditoria {
  usuarioId: string | null;
  entidad: string;
  entidadId: string;
  accion: string;
  detalle?: { [clave: string]: ValorDetalleAuditoria };
  direccionIp: string | null;
}
