import { Injectable } from '@nestjs/common';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import { PrismaService } from '../../../../database/prisma.service.js';
import type { Prisma } from '../../../../generated/prisma/client.js';
import { Insumo, TIPOS_INSUMO } from '../../domain/entities/insumo.entity.js';
import {
  type FiltrosInsumos,
  InsumosRepositorio,
} from '../../domain/repositories/insumos.repository.js';
import { aNumero, siDuplicado, valorConocido } from './conversiones.js';

type RegistroInsumo = Prisma.InsumoGetPayload<object>;

@Injectable()
export class PrismaInsumosRepositorio extends InsumosRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async buscarPorId(id: string): Promise<Insumo | null> {
    const registro = await this.prisma.insumo.findUnique({ where: { id } });
    return registro ? this.aEntidad(registro) : null;
  }

  async buscarVarios(ids: readonly string[]): Promise<Insumo[]> {
    if (ids.length === 0) return [];
    const registros = await this.prisma.insumo.findMany({
      where: { id: { in: [...ids] } },
    });
    return registros.map((r) => this.aEntidad(r));
  }

  async existeCodigo(codigo: string, excluirId?: string): Promise<boolean> {
    const total = await this.prisma.insumo.count({
      where: { codigo, id: excluirId ? { not: excluirId } : undefined },
    });
    return total > 0;
  }

  async tieneHistorial(insumoId: string): Promise<boolean> {
    const [existencias, movimientos] = await this.prisma.$transaction([
      this.prisma.existencia.count({ where: { insumoId } }),
      this.prisma.detalleMovimiento.count({ where: { insumoId } }),
    ]);
    return existencias + movimientos > 0;
  }

  async listar(
    filtros: FiltrosInsumos,
    { pagina, limite }: Paginacion,
  ): Promise<ResultadoPaginado<Insumo>> {
    const where: Prisma.InsumoWhereInput = {
      tipo: filtros.tipo,
      activo: filtros.activo,
      esControlEspecial: filtros.esControlEspecial,
      OR: filtros.busqueda
        ? [
            { codigo: { contains: filtros.busqueda } },
            { nombre: { contains: filtros.busqueda } },
            { categoria: { contains: filtros.busqueda } },
          ]
        : undefined,
    };
    const [total, registros] = await this.prisma.$transaction([
      this.prisma.insumo.count({ where }),
      this.prisma.insumo.findMany({
        where,
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

  async crear(insumo: Insumo): Promise<Insumo> {
    const registro = await siDuplicado(
      () =>
        this.prisma.insumo.create({
          data: {
            id: insumo.id,
            ...this.datos(insumo),
            creadoEn: insumo.creadoEn,
          },
        }),
      `Ya existe un insumo con el código ${insumo.codigo}`,
    );
    return this.aEntidad(registro);
  }

  async actualizar(insumo: Insumo): Promise<Insumo> {
    const registro = await siDuplicado(
      () =>
        this.prisma.insumo.update({
          where: { id: insumo.id },
          data: this.datos(insumo),
        }),
      `Ya existe un insumo con el código ${insumo.codigo}`,
    );
    return this.aEntidad(registro);
  }

  private datos(insumo: Insumo) {
    return {
      codigo: insumo.codigo,
      nombre: insumo.nombre,
      descripcion: insumo.descripcion,
      tipo: insumo.tipo,
      categoria: insumo.categoria,
      unidadMedida: insumo.unidadMedida,
      marca: insumo.marca,
      fabricante: insumo.fabricante,
      requiereLote: insumo.requiereLote,
      requiereVencimiento: insumo.requiereVencimiento,
      requiereRegistroSanitario: insumo.requiereRegistroSanitario,
      requiereSerie: insumo.requiereSerie,
      esControlEspecial: insumo.esControlEspecial,
      stockMinimo: insumo.stockMinimo,
      activo: insumo.activo,
    };
  }

  private aEntidad(registro: RegistroInsumo): Insumo {
    return Insumo.reconstruir({
      ...registro,
      tipo: valorConocido(TIPOS_INSUMO, registro.tipo, 'inv_insumos.tipo'),
      stockMinimo: aNumero(registro.stockMinimo),
    });
  }
}
