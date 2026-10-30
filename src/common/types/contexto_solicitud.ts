import type { NombreRol } from '../constants/roles.js';

/** Quién ejecuta una operación y desde dónde, para trazabilidad y auditoría. */
export interface ContextoSolicitud {
  usuarioId: string | null;
  direccionIp: string | null;
  /** Rol de quien ejecuta; opcional para los procesos internos y las pruebas. */
  rol?: NombreRol | null;
}
