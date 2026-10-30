import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { VariablesEntorno } from '../../config/variables_entorno.js';
import { AuditModule } from '../audit/audit.module.js';
import { UsersModule } from '../users/users.module.js';
import { CambiarContrasena } from './application/use-cases/cambiar_contrasena.use-case.js';
import { CerrarSesion } from './application/use-cases/cerrar_sesion.use-case.js';
import { IniciarSesion } from './application/use-cases/iniciar_sesion.use-case.js';
import { ObtenerPerfil } from './application/use-cases/obtener_perfil.use-case.js';
import { ValidarSesion } from './application/use-cases/validar_sesion.use-case.js';
import { VerificarSesionToken } from './application/use-cases/verificar_sesion_token.use-case.js';
import { SesionesRepositorio } from './domain/repositories/sesiones.repository.js';
import { EmisorTokens } from './domain/services/emisor_tokens.service.js';
import { VerificadorTokens } from './domain/services/verificador_tokens.service.js';
import { PrismaSesionesRepositorio } from './infrastructure/repositories/prisma_sesiones.repository.js';
import {
  EMISOR_JWT,
  JwtEmisorTokens,
} from './infrastructure/services/jwt_emisor_tokens.service.js';
import { JwtVerificadorTokens } from './infrastructure/services/jwt_verificador_tokens.service.js';
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy.js';
import { AutenticacionController } from './presentation/controllers/autenticacion.controller.js';
import { SesionesInternasController } from './presentation/controllers/sesiones_internas.controller.js';

@Module({
  imports: [
    UsersModule,
    AuditModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configuracion: ConfigService<VariablesEntorno, true>) => ({
        secret: configuracion.get('JWT_SECRETO', { infer: true }),
        signOptions: { algorithm: 'HS256', issuer: EMISOR_JWT },
      }),
    }),
  ],
  controllers: [AutenticacionController, SesionesInternasController],
  providers: [
    { provide: SesionesRepositorio, useClass: PrismaSesionesRepositorio },
    { provide: EmisorTokens, useClass: JwtEmisorTokens },
    { provide: VerificadorTokens, useClass: JwtVerificadorTokens },
    JwtStrategy,
    IniciarSesion,
    ValidarSesion,
    CerrarSesion,
    ObtenerPerfil,
    CambiarContrasena,
    VerificarSesionToken,
  ],
})
export class AuthenticationModule {}
