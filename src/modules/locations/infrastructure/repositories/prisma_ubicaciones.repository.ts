import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service.js';
import type { Prisma } from '../../../../generated/prisma/client.js';
import type { Ubicacion } from '../../domain/entities/ubicacion.entity.js';
import {
  type FiltrosRecorrido,
  UbicacionesRepositorio,
} from '../../domain/repositories/ubicaciones.repository.js';

const seleccionUbicacion = {
  id: true,
  ambulanciaId: true,
  asignacionId: true,
  latitud: true,
  longitud: true,
  velocidad: true,
  registradaEn: true,
} satisfies Prisma.UbicacionAmbulanciaSelect;

@Injectable()
export class PrismaUbicacionesRepositorio extends UbicacionesRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async registrar(ubicacion: Ubicacion): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.ubicacionAmbulancia.create({ data: { ...ubicacion } }),
      this.prisma.ambulancia.updateMany({
        where: {
          id: ubicacion.ambulanciaId,
          OR: [
            { ultimaUbicacionEn: null },
            { ultimaUbicacionEn: { lt: ubicacion.registradaEn } },
          ],
        },
        data: {
          ultimaLatitud: ubicacion.latitud,
          ultimaLongitud: ubicacion.longitud,
          ultimaUbicacionEn: ubicacion.registradaEn,
        },
      }),
    ]);
  }

  async listarRecorrido(
    filtros: FiltrosRecorrido,
    limite: number,
  ): Promise<Ubicacion[]> {
    const registros = await this.prisma.ubicacionAmbulancia.findMany({
      where: {
        ambulanciaId: filtros.ambulanciaId,
        asignacionId: filtros.asignacionId,
        registradaEn:
          filtros.desde || filtros.hasta
            ? { gte: filtros.desde, lte: filtros.hasta }
            : undefined,
      },
      select: seleccionUbicacion,
      // Los más recientes primero para quedarse con los últimos `limite`...
      orderBy: { registradaEn: 'desc' },
      take: limite,
    });
    // ...y se devuelven en orden cronológico para dibujar la línea.
    return registros.reverse().map((registro) => ({
      ...registro,
      latitud: registro.latitud.toNumber(),
      longitud: registro.longitud.toNumber(),
      velocidad: registro.velocidad?.toNumber() ?? null,
    }));
  }
}
