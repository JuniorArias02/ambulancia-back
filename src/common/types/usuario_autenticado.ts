import type { NombreRol } from '../constants/roles.js';

export interface UsuarioAutenticado {
  id: string;
  correo: string;
  rol: NombreRol;
  sesionId: string;
}

declare global {
  // Passport asigna el resultado de la estrategia JWT a `request.user`.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends UsuarioAutenticado {}
  }
}
