import { createHash, timingSafeEqual } from 'node:crypto';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { VariablesEntorno } from '../../config/variables_entorno.js';
import { AccesoDenegadoError } from '../exceptions/errores_dominio.js';

/** Cabecera con la que se autentican entre sí la API y el servidor de tiempo real. */
export const CABECERA_CLAVE_INTERNA = 'x-clave-interna';

/**
 * Protege las rutas que solo llama el servidor de tiempo real. Responde 403
 * (no 401) para que ese servidor no lo confunda con una sesión de usuario inválida.
 */
@Injectable()
export class ClaveInternaGuard implements CanActivate {
  private readonly huellaEsperada: Buffer | null;

  constructor(configuracion: ConfigService<VariablesEntorno, true>) {
    const clave = configuracion.get('TIEMPO_REAL_CLAVE_INTERNA', {
      infer: true,
    });
    this.huellaEsperada = clave ? huellaDe(clave) : null;
  }

  canActivate(contexto: ExecutionContext): boolean {
    const recibida = contexto
      .switchToHttp()
      .getRequest<Request>()
      .header(CABECERA_CLAVE_INTERNA);
    if (
      !this.huellaEsperada ||
      !recibida ||
      !timingSafeEqual(huellaDe(recibida), this.huellaEsperada)
    ) {
      throw new AccesoDenegadoError('Clave interna inválida');
    }
    return true;
  }
}

/** Se comparan huellas de igual longitud para que el tiempo no revele la clave. */
function huellaDe(valor: string): Buffer {
  return createHash('sha256').update(valor).digest();
}
