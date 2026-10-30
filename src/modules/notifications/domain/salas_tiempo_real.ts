/**
 * Nombres de sala compartidos con el servidor de tiempo real (`webSocket/`),
 * que es quien mete a cada conexión en ellas según su rol.
 */

/** Panel de coordinación: hoy administradores y despachadores ven lo mismo. */
export const SALA_CENTRAL = 'central';

/**
 * Por persona y no por ambulancia: la tripulación de una ambulancia cambia
 * con los turnos y así no hay que mantener esas salas sincronizadas.
 */
export function salaDeUsuario(usuarioId: string): string {
  return `usuario:${usuarioId}`;
}
