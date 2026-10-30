import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { NoAutenticadoError } from '../../../../common/exceptions/errores_dominio.js';
import type { UsuarioAutenticado } from '../../../../common/types/usuario_autenticado.js';
import type { VariablesEntorno } from '../../../../config/variables_entorno.js';
import { ValidarSesion } from '../../application/use-cases/validar_sesion.use-case.js';
import {
  EMISOR_JWT,
  esCargaJwt,
} from '../services/jwt_emisor_tokens.service.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configuracion: ConfigService<VariablesEntorno, true>,
    private readonly validarSesion: ValidarSesion,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configuracion.get('JWT_SECRETO', { infer: true }),
      issuer: EMISOR_JWT,
      algorithms: ['HS256'],
    });
  }

  async validate(carga: unknown): Promise<UsuarioAutenticado> {
    if (!esCargaJwt(carga)) {
      throw new NoAutenticadoError('Token inválido');
    }
    return this.validarSesion.ejecutar({
      usuarioId: carga.sub,
      sesionId: carga.sid,
    });
  }
}
