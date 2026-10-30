import type { Sesion } from '../entities/sesion.entity.js';

export abstract class SesionesRepositorio {
  abstract guardar(sesion: Sesion): Promise<void>;
  abstract buscarPorId(id: string): Promise<Sesion | null>;
  abstract revocar(id: string, fecha: Date): Promise<void>;
  abstract revocarTodasDelUsuario(
    usuarioId: string,
    fecha: Date,
  ): Promise<void>;
}
