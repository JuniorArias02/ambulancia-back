import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service.js';
import type { TipoAmbulancia } from '../../domain/entities/tipo_ambulancia.entity.js';
import { TiposAmbulanciaRepositorio } from '../../domain/repositories/tipos_ambulancia.repository.js';

const seleccionTipo = { id: true, nombre: true, descripcion: true } as const;

@Injectable()
export class PrismaTiposAmbulanciaRepositorio extends TiposAmbulanciaRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  listar(): Promise<TipoAmbulancia[]> {
    return this.prisma.tipoAmbulancia.findMany({
      select: seleccionTipo,
      orderBy: { nombre: 'asc' },
    });
  }

  buscarPorId(id: string): Promise<TipoAmbulancia | null> {
    return this.prisma.tipoAmbulancia.findUnique({
      where: { id },
      select: seleccionTipo,
    });
  }
}
