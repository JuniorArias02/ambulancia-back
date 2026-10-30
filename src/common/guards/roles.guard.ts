import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { NombreRol } from '../constants/roles.js';
import { ROLES_REQUERIDOS } from '../decorators/requiere_roles.decorator.js';
import { AccesoDenegadoError } from '../exceptions/errores_dominio.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const rolesRequeridos = this.reflector.getAllAndOverride<
      NombreRol[] | undefined
    >(ROLES_REQUERIDOS, [contexto.getHandler(), contexto.getClass()]);

    if (!rolesRequeridos || rolesRequeridos.length === 0) return true;

    const usuario = contexto.switchToHttp().getRequest<Request>().user;
    const autorizado =
      usuario !== undefined && rolesRequeridos.includes(usuario.rol);

    if (!autorizado) throw new AccesoDenegadoError();
    return true;
  }
}
