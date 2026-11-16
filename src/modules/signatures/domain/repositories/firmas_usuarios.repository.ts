import type { FirmaUsuario } from '../entities/firma_usuario.entity.js';

export abstract class FirmasUsuariosRepositorio {
  abstract buscarPorId(id: string): Promise<FirmaUsuario | null>;
  abstract buscarVigente(usuarioId: string): Promise<FirmaUsuario | null>;
  /** De la más reciente a la más antigua. */
  abstract listarDeUsuario(usuarioId: string): Promise<FirmaUsuario[]>;
  /**
   * Guarda la nueva como vigente y deja la anterior como reemplazada, en una
   * sola transacción: nunca quedan dos vigentes del mismo usuario.
   */
  abstract registrar(firma: FirmaUsuario): Promise<FirmaUsuario>;
  /** Falla con 409 si ya no estaba vigente (otro la cambió mientras tanto). */
  abstract desactivar(firma: FirmaUsuario): Promise<FirmaUsuario>;
}
