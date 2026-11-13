import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service.js';
import { ESTADOS_EQUIPO } from '../../domain/entities/equipo.entity.js';
import {
  type AlertasInventario,
  AlertasInventarioRepositorio,
  type InsumoBajoMinimo,
} from '../../domain/repositories/alertas_inventario.repository.js';
import {
  aFechaBd,
  aNumero,
  deFechaBd,
  nombreUbicacion,
  seleccionNombreUbicacion,
  valorConocido,
} from './conversiones.js';

/** Tope por lista: el tablero muestra lo más urgente primero. */
const MAXIMO_POR_ALERTA = 100;

@Injectable()
export class PrismaAlertasInventarioRepositorio extends AlertasInventarioRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async obtener(limite: string): Promise<AlertasInventario> {
    const fechaLimite = aFechaBd(limite);
    const [lotes, equipos, registros, insumosBajoMinimo] = await Promise.all([
      this.prisma.existencia.findMany({
        where: {
          cantidad: { gt: 0 },
          lote: { fechaVencimiento: { lte: fechaLimite } },
        },
        select: {
          ubicacionId: true,
          cantidad: true,
          ubicacion: { select: seleccionNombreUbicacion },
          insumo: { select: { id: true, nombre: true } },
          lote: {
            select: { id: true, numeroLote: true, fechaVencimiento: true },
          },
        },
        orderBy: { lote: { fechaVencimiento: 'asc' } },
        take: MAXIMO_POR_ALERTA,
      }),
      this.prisma.equipo.findMany({
        where: {
          estado: { not: 'baja' },
          fechaProximoMantenimiento: { lte: fechaLimite },
        },
        select: {
          id: true,
          numeroSerie: true,
          estado: true,
          fechaProximoMantenimiento: true,
          insumo: { select: { nombre: true } },
        },
        orderBy: { fechaProximoMantenimiento: 'asc' },
        take: MAXIMO_POR_ALERTA,
      }),
      this.prisma.registroSanitario.findMany({
        where: { estado: 'vigente', fechaVencimiento: { lte: fechaLimite } },
        select: {
          id: true,
          numeroRegistro: true,
          fechaVencimiento: true,
          insumo: { select: { id: true, nombre: true } },
        },
        orderBy: { fechaVencimiento: 'asc' },
        take: MAXIMO_POR_ALERTA,
      }),
      this.insumosBajoMinimo(),
    ]);

    return {
      lotesPorVencer: lotes.flatMap((e) =>
        e.lote?.fechaVencimiento
          ? [
              {
                loteId: e.lote.id,
                numeroLote: e.lote.numeroLote,
                fechaVencimiento: deFechaBd(e.lote.fechaVencimiento),
                insumoId: e.insumo.id,
                insumoNombre: e.insumo.nombre,
                ubicacionId: e.ubicacionId,
                ubicacionNombre: nombreUbicacion(e.ubicacion),
                cantidad: aNumero(e.cantidad),
              },
            ]
          : [],
      ),
      equiposPorMantenimiento: equipos.flatMap((e) =>
        e.fechaProximoMantenimiento
          ? [
              {
                equipoId: e.id,
                numeroSerie: e.numeroSerie,
                insumoNombre: e.insumo.nombre,
                estado: valorConocido(
                  ESTADOS_EQUIPO,
                  e.estado,
                  'inv_equipos.estado',
                ),
                fechaProximoMantenimiento: deFechaBd(
                  e.fechaProximoMantenimiento,
                ),
              },
            ]
          : [],
      ),
      registrosPorVencer: registros.flatMap((r) =>
        r.fechaVencimiento
          ? [
              {
                registroId: r.id,
                numeroRegistro: r.numeroRegistro,
                insumoId: r.insumo.id,
                insumoNombre: r.insumo.nombre,
                fechaVencimiento: deFechaBd(r.fechaVencimiento),
              },
            ]
          : [],
      ),
      insumosBajoMinimo,
    };
  }

  /** El stock mínimo se compara con lo que hay en bodegas activas (lo de las ambulancias ya salió). */
  private async insumosBajoMinimo(): Promise<InsumoBajoMinimo[]> {
    const insumos = await this.prisma.insumo.findMany({
      where: { activo: true, stockMinimo: { gt: 0 } },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        unidadMedida: true,
        stockMinimo: true,
      },
    });
    if (insumos.length === 0) return [];
    const sumas = await this.prisma.existencia.groupBy({
      by: ['insumoId'],
      where: {
        insumoId: { in: insumos.map((i) => i.id) },
        ubicacion: { tipo: 'bodega', activa: true },
      },
      _sum: { cantidad: true },
    });
    const enBodegas = new Map(
      sumas.map((s) => [s.insumoId, aNumero(s._sum.cantidad) ?? 0]),
    );
    return insumos
      .map((i) => ({
        insumoId: i.id,
        insumoCodigo: i.codigo,
        insumoNombre: i.nombre,
        unidadMedida: i.unidadMedida,
        stockMinimo: aNumero(i.stockMinimo),
        enBodegas: enBodegas.get(i.id) ?? 0,
      }))
      .filter((i) => i.enBodegas < i.stockMinimo)
      .slice(0, MAXIMO_POR_ALERTA);
  }
}
