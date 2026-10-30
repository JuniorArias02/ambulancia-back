import { Injectable } from '@nestjs/common';
import type { Rol } from '../../domain/entities/rol.entity.js';
import { RolesRepositorio } from '../../domain/repositories/roles.repository.js';

@Injectable()
export class ConsultarRoles {
  constructor(private readonly rolesRepositorio: RolesRepositorio) {}

  ejecutar(): Promise<Rol[]> {
    return this.rolesRepositorio.listar();
  }
}
