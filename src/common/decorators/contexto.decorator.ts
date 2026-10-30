import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { ContextoSolicitud } from '../types/contexto_solicitud.js';

export const Contexto = createParamDecorator(
  (_datos: unknown, contexto: ExecutionContext): ContextoSolicitud => {
    const solicitud = contexto.switchToHttp().getRequest<Request>();
    return {
      usuarioId: solicitud.user?.id ?? null,
      direccionIp: solicitud.ip ?? null,
      rol: solicitud.user?.rol ?? null,
    };
  },
);
