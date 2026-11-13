import { Injectable } from '@nestjs/common';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import { PrismaService } from '../../../../database/prisma.service.js';
import type { Prisma } from '../../../../generated/prisma/client.js';
import { Bodega } from '../../domain/entities/bodega.entity.js';
import type { UbicacionInventario } from '../../domain/entities/ubicacion_inventario.entity.js';
import {
  BodegasRepositorio,
  type FiltrosBodegas,
} from '../../domain/repositories/bodegas.repository.js';
import { nombreCompleto, siDuplicado } from './conversiones.js';

const seleccion = {
  id: true,
  codigo: true,
  nombre: true,
  ubicacion: true,
  responsableId: true,
  activa: true,
  creadaEn: true,
  actualizadaEn: true,
  responsable: { select: { nombres: true, apellidos: true } },
  ubicacionInventario: { select: { id: true } },
} satisfies Prisma.BodegaSelect;

type Registro = Prisma.BodegaGetPayload<{ select: typeof seleccion }>;

@Injectable()
export class PrismaBodegasRepositorio extends BodegasRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async buscarPorId(id: string): Promise<Bodega | null> {
    const registro = await this.prisma.bodega.findUnique({
      where: { id },
      select: seleccion,
    });
    return registro ? this.aEntidad(registro) : null;
  }

  async existeCodigo(codigo: string, excluirId?: string): Promise<boolean> {
    const total = await this.prisma.bodega.count({
      where: { codigo, id: excluirId ? { not: excluirId } : undefined },
    });
    return total > 0;
  }

  async listar(
    filtros: FiltrosBodegas,
    { pagina, limite }: Paginacion,
  ): Promise<ResultadoPaginado<Bodega>> {
    const where: Prisma.BodegaWhereInput = {
      activa: filtros.activa,
      OR: filtros.busqueda
        ? [
            { codigo: { contains: filtros.busqueda } },
            { nombre: { contains: filtros.busqueda } },
          ]
        : undefined,
    };
    const [total, registros] = await this.prisma.$transaction([
      this.prisma.bodega.count({ where }),
      this.prisma.bodega.findMany({
        where,
        select: seleccion,
        orderBy: { nombre: 'asc' },
        skip: (pagina - 1) * limite,
        take: limite,
      }),
    ]);
    return {
      datos: registros.map((r) => this.aEntidad(r)),
      total,
      pagina,
      limite,
    };
  }

  async crear(bodega: Bodega, ubicacion: UbicacionInventario): Promise<Bodega> {
    const registro = await siDuplicado(
      () =>
        this.prisma.bodega.create({
          data: {
            id: bodega.id,
            codigo: bodega.codigo,
            nombre: bodega.nombre,
            ubicacion: bodega.ubicacion,
            responsableId: bodega.responsableId,
            activa: bodega.activa,
            creadaEn: bodega.creadaEn,
            ubicacionInventario: {
              create: {
                id: ubicacion.id,
                tipo: ubicacion.tipo,
                activa: ubicacion.activa,
                creadaEn: ubicacion.creadaEn,
              },
            },
          },
          select: seleccion,
        }),
      `Ya existe una bodega con el código ${bodega.codigo}`,
    );
    return this.aEntidad(registro);
  }

  async actualizar(bodega: Bodega): Promise<Bodega> {
    const registro = await siDuplicado(
      () =>
        this.prisma.bodega.update({
          where: { id: bodega.id },
          data: {
            codigo: bodega.codigo,
            nombre: bodega.nombre,
            ubicacion: bodega.ubicacion,
            responsableId: bodega.responsableId,
            activa: bodega.activa,
            ubicacionInventario: { update: { activa: bodega.activa } },
          },
          select: seleccion,
        }),
      `Ya existe una bodega con el código ${bodega.codigo}`,
    );
    return this.aEntidad(registro);
  }

  private aEntidad(registro: Registro): Bodega {
    return Bodega.reconstruir({
      id: registro.id,
      codigo: registro.codigo,
      nombre: registro.nombre,
      ubicacion: registro.ubicacion,
      responsableId: registro.responsableId,
      activa: registro.activa,
      creadaEn: registro.creadaEn,
      actualizadaEn: registro.actualizadaEn,
      responsableNombre: nombreCompleto(registro.responsable),
      ubicacionInventarioId: registro.ubicacionInventario?.id ?? null,
    });
  }
}
