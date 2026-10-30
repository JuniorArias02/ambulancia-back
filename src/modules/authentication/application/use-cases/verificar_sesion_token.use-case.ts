import { Injectable } from '@nestjs/common';
import type { UsuarioAutenticado } from '../../../../common/types/usuario_autenticado.js';
import { VerificadorTokens } from '../../domain/services/verificador_tokens.service.js';
import { ValidarSesion } from './validar_sesion.use-case.js';

export interface SesionVerificada {
  usuario: UsuarioAutenticado;
  expiraEn: Date;
}

/**
 * Para el servidor de tiempo real, que no tiene acceso a la base: comprueba el
 * token y la sesión igual que en cada solicitud REST.
 */
@Injectable()
export class VerificarSesionToken {
  constructor(
    private readonly verificadorTokens: VerificadorTokens,
    private readonly validarSesion: ValidarSesion,
  ) {}

  async ejecutar(token: string): Promise<SesionVerificada> {
    const { usuarioId, sesionId, expiraEn } =
      await this.verificadorTokens.verificar(token);
    const usuario = await this.validarSesion.ejecutar({ usuarioId, sesionId });
    return { usuario, expiraEn };
  }
}
