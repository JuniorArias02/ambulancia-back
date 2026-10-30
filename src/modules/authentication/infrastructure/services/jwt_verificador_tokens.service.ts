import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NoAutenticadoError } from '../../../../common/exceptions/errores_dominio.js';
import {
  type TokenVerificado,
  VerificadorTokens,
} from '../../domain/services/verificador_tokens.service.js';
import { EMISOR_JWT, esCargaJwt } from './jwt_emisor_tokens.service.js';

/** Las mismas reglas que aplica `JwtStrategy` a las solicitudes REST. */
@Injectable()
export class JwtVerificadorTokens extends VerificadorTokens {
  constructor(private readonly jwt: JwtService) {
    super();
  }

  async verificar(token: string): Promise<TokenVerificado> {
    let carga: unknown;
    try {
      carga = await this.jwt.verifyAsync<object>(token, {
        issuer: EMISOR_JWT,
        algorithms: ['HS256'],
      });
    } catch {
      throw new NoAutenticadoError('Token inválido o expirado');
    }
    if (
      !esCargaJwt(carga) ||
      !('exp' in carga) ||
      typeof carga.exp !== 'number'
    ) {
      throw new NoAutenticadoError('Token inválido');
    }
    return {
      usuarioId: carga.sub,
      sesionId: carga.sid,
      expiraEn: new Date(carga.exp * 1000),
    };
  }
}
