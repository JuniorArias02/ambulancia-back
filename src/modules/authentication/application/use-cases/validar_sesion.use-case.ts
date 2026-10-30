import { Injectable } from '@nestjs/common';
import { NoAutenticadoError } from '../../../../common/exceptions/errores_dominio.js';
import type { UsuarioAutenticado } from '../../../../common/types/usuario_autenticado.js';
import { UsuariosRepositorio } from '../../../users/domain/repositories/usuarios.repository.js';
import { SesionesRepositorio } from '../../domain/repositories/sesiones.repository.js';
import type { ContenidoToken } from '../../domain/services/emisor_tokens.service.js';

/**
 * Se ejecuta en cada solicitud autenticada: un token con firma válida no basta
 * si la sesión fue revocada o el usuario dejó de estar activo.
 */
@Injectable()
export class ValidarSesion {
  constructor(
    private readonly sesionesRepositorio: SesionesRepositorio,
    private readonly usuariosRepositorio: UsuariosRepositorio,
  ) {}

  async ejecutar({
    usuarioId,
    sesionId,
  }: ContenidoToken): Promise<UsuarioAutenticado> {
    const sesion = await this.sesionesRepositorio.buscarPorId(sesionId);
    if (
      !sesion ||
      sesion.usuarioId !== usuarioId ||
      !sesion.estaVigente(new Date())
    ) {
      throw new NoAutenticadoError('Sesión inválida o expirada');
    }

    const usuario = await this.usuariosRepositorio.buscarPorId(usuarioId);
    if (!usuario || !usuario.estaActivo()) {
      throw new NoAutenticadoError('Sesión inválida o expirada');
    }

    return {
      id: usuario.id,
      correo: usuario.correo,
      rol: usuario.rol,
      sesionId,
    };
  }
}
