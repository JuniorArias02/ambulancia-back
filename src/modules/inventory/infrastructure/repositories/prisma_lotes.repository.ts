import { Injectable } from '@nestjs/common';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import { PrismaService } from '../../../../database/prisma.service.js';
import type { Prisma } from '../../../../generated/prisma/client.js';
import { Lote } from '../../domain/entities/lote.entity.js';
import {
  type FiltrosLotes,
  LotesRepositorio,
} from '../../domain/repositories/lotes.repository.js';
import { aFechaBd, deFechaBd, siDuplicado } from './conversiones.js';

const seleccion = {
  id: true,
  insumoId: true,
  registroSanitarioId: true,
  numeroLote: true,
  fechaFabricacion: true,
  fechaVencimiento: true,
  fabricante: true,
  proveedor: true,
  recibidoEn: true,
  documentoSoporte: true,
  observaciones: true,
  creadoEn: true,
  insumo: { select: { nombre: true, requiereVencimiento: true } },
} satisfies Prisma.LoteSelect;

type Registro = Prisma.LoteGetPayload<{ select: typeof seleccion }>;

@Injectable()
export class PrismaLotesRepositorio extends LotesRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async buscarPorId(id: string): Promise<Lote | null> {
    const registro = await this.prisma.lote.findUnique({
      where: { id },
      select: seleccion,
    });
    return registro ? this.aEntidad(registro) : null;
  }

  async buscarVarios(ids: readonly string[]): Promise<Lote[]> {
    if (ids.length === 0) return [];
    const registros = await this.prisma.lote.findMany({
      where: { id: { in: [...ids] } },
      select: seleccion,
    });
    return registros.map((r) => this.aEntidad(r));
  }

  async existeNumero(insumoId: string, numeroLote: string): Promise<boolean> {
    const total = await this.prisma.lote.count({
      where: { insumoId, numeroLote },
    });
    return total > 0;
  }

  async listar(
    filtros: FiltrosLotes,
    { pagina, limite }: Paginacion,
  ): Promise<ResultadoPaginado<Lote>> {
    const where: Prisma.LoteWhereInput = {
      insumoId: filtros.insumoId,
      numeroLote: filtros.busqueda ? { contains: filtros.busqueda } : undefined,
      fechaVencimiento: filtros.vencenHasta
        ? { lte: aFechaBd(filtros.vencenHasta) }
        : undefined,
    };
    const [total, registros] = await this.prisma.$transaction([
      this.prisma.lote.count({ where }),
      this.prisma.lote.findMany({
        where,
        select: seleccion,
        orderBy: [{ fechaVencimiento: 'asc' }, { numeroLote: 'asc' }],
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

  async crear(lote: Lote): Promise<Lote> {
    const registro = await siDuplicado(
      () =>
        this.prisma.lote.create({
          data: {
            id: lote.id,
            insumoId: lote.insumoId,
            registroSanitarioId: lote.registroSanitarioId,
            numeroLote: lote.numeroLote,
            recibidoEn: lote.recibidoEn,
            creadoEn: lote.creadoEn,
            ...this.datosEditables(lote),
          },
          select: seleccion,
        }),
      `El lote ${lote.numeroLote} ya está registrado para este insumo`,
    );
    return this.aEntidad(registro);
  }

  async actualizar(lote: Lote): Promise<Lote> {
    const registro = await this.prisma.lote.update({
      where: { id: lote.id },
      data: this.datosEditables(lote),
      select: seleccion,
    });
    return this.aEntidad(registro);
  }

  private datosEditables(lote: Lote) {
    return {
      fechaFabricacion: aFechaBd(lote.fechaFabricacion),
      fechaVencimiento: aFechaBd(lote.fechaVencimiento),
      fabricante: lote.fabricante,
      proveedor: lote.proveedor,
      documentoSoporte: lote.documentoSoporte,
      observaciones: lote.observaciones,
    };
  }

  private aEntidad(registro: Registro): Lote {
    return Lote.reconstruir({
      id: registro.id,
      insumoId: registro.insumoId,
      registroSanitarioId: registro.registroSanitarioId,
      numeroLote: registro.numeroLote,
      fechaFabricacion: deFechaBd(registro.fechaFabricacion),
      fechaVencimiento: deFechaBd(registro.fechaVencimiento),
      fabricante: registro.fabricante,
      proveedor: registro.proveedor,
      recibidoEn: registro.recibidoEn,
      documentoSoporte: registro.documentoSoporte,
      observaciones: registro.observaciones,
      creadoEn: registro.creadoEn,
      insumoNombre: registro.insumo.nombre,
      requiereVencimiento: registro.insumo.requiereVencimiento,
    });
  }
}
