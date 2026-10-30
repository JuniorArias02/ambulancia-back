import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { VariablesEntorno } from '../../../../config/variables_entorno.js';
import {
  type ContenidoToken,
  EmisorTokens,
  type TokenEmitido,
} from '../../domain/services/emisor_tokens.service.js';

export const EMISOR_JWT = 'ambulancias-galenos-api';

/** Claims propios del token: `sub` es el usuario y `sid` la sesión. */
export interface CargaJwt {
  sub: string;
  sid: string;
}

export function esCargaJwt(carga: unknown): carga is CargaJwt {
  return (
    typeof carga === 'object' &&
    carga !== null &&
    'sub' in carga &&
    'sid' in carga &&
    typeof carga.sub === 'string' &&
    typeof carga.sid === 'string'
  );
}

@Injectable()
export class JwtEmisorTokens extends EmisorTokens {
  constructor(
    private readonly jwt: JwtService,
    private readonly configuracion: ConfigService<VariablesEntorno, true>,
  ) {
    super();
  }

  async emitir({ usuarioId, sesionId }: ContenidoToken): Promise<TokenEmitido> {
    const segundos = this.configuracion.get('JWT_EXPIRACION_SEGUNDOS', {
      infer: true,
    });
    const emitidoEn = Date.now();
    const carga: CargaJwt = { sub: usuarioId, sid: sesionId };
    const token = await this.jwt.signAsync(carga, { expiresIn: segundos });

    return {
      token,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiraEn: new Date(emitidoEn + segundos * 1000),
    };
  }
}
