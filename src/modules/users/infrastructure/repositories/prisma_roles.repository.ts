import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service.js';
import type { Rol } from '../../domain/entities/rol.entity.js';
import { RolesRepositorio } from '../../domain/repositories/roles.repository.js';

@Injectable()
export class PrismaRolesRepositorio extends RolesRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  listar(): Promise<Rol[]> {
    return this.prisma.rol.findMany({
      select: { id: true, nombre: true, descripcion: true },
      orderBy: { nombre: 'asc' },
    });
  }
}
