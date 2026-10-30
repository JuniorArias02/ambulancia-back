import { SetMetadata } from '@nestjs/common';
import type { NombreRol } from '../constants/roles.js';

export const ROLES_REQUERIDOS = 'roles_requeridos';

/** El usuario autenticado debe tener alguno de los roles indicados. */
export const RequiereRoles = (...roles: NombreRol[]) =>
  SetMetadata(ROLES_REQUERIDOS, roles);
