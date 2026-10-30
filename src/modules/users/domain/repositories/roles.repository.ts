import type { Rol } from '../entities/rol.entity.js';

export abstract class RolesRepositorio {
  abstract listar(): Promise<Rol[]>;
}
