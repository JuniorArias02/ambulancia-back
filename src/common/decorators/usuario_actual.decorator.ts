import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { NoAutenticadoError } from '../exceptions/errores_dominio.js';
import type { UsuarioAutenticado } from '../types/usuario_autenticado.js';

export const UsuarioActual = createParamDecorator(
  (_datos: unknown, contexto: ExecutionContext): UsuarioAutenticado => {
    const solicitud = contexto.switchToHttp().getRequest<Request>();
    if (!solicitud.user) {
      throw new NoAutenticadoError('No autenticado');
    }
    return solicitud.user;
  },
);
