import { Injectable } from '@nestjs/common';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import { PrismaService } from '../../../../database/prisma.service.js';
import type { Prisma } from '../../../../generated/prisma/client.js';
import { ESTADOS_EQUIPO } from '../../domain/entities/equipo.entity.js';
import type { Existencia } from '../../domain/entities/existencia.js';
import { TIPOS_UBICACION } from '../../domain/entities/ubicacion_inventario.entity.js';
import {
  ExistenciasRepositorio,
  type FiltrosExistencias,
} from '../../domain/repositories/existencias.repository.js';
import {
  aNumero,
  deFechaBd,
  nombreUbicacion,
  seleccionNombreUbicacion,
  valorConocido,
} from './conversiones.js';

export const seleccionExistencia = {
  id: true,
  ubicacionId: true,
  insumoId: true,
  loteId: true,
  equipoId: true,
  claveControl: true,
  cantidad: true,
  actualizadaEn: true,
  ubicacion: { select: { tipo: true, ...seleccionNombreUbicacion } },
  insumo: { select: { codigo: true, nombre: true, unidadMedida: true } },
  lote: { select: { numeroLote: true, fechaVencimiento: true } },
  equipo: { select: { numeroSerie: true, estado: true } },
} satisfies Prisma.ExistenciaSelect;

type Registro = Prisma.ExistenciaGetPayload<{
  select: typeof seleccionExistencia;
}>;

export function aExistencia(registro: Registro): Existencia {
  return {
    id: registro.id,
    ubicacionId: registro.ubicacionId,
    ubicacionTipo: valorConocido(
      TIPOS_UBICACION,
      registro.ubicacion.tipo,
      'inv_ubicaciones.tipo',
    ),
    ubicacionNombre: nombreUbicacion(registro.ubicacion),
    insumoId: registro.insumoId,
    insumoCodigo: registro.insumo.codigo,
    insumoNombre: registro.insumo.nombre,
    unidadMedida: registro.insumo.unidadMedida,
    loteId: registro.loteId,
    numeroLote: registro.lote?.numeroLote ?? null,
    loteVencimiento: deFechaBd(registro.lote?.fechaVencimiento ?? null),
    equipoId: registro.equipoId,
    numeroSerie: registro.equipo?.numeroSerie ?? null,
    equipoEstado: registro.equipo
      ? valorConocido(
          ESTADOS_EQUIPO,
          registro.equipo.estado,
          'inv_equipos.estado',
        )
      : null,
    claveControl: registro.claveControl,
    cantidad: aNumero(registro.cantidad),
    actualizadaEn: registro.actualizadaEn,
  };
}

const ORDEN: Prisma.ExistenciaOrderByWithRelationInput[] = [
  { insumo: { nombre: 'asc' } },
  { lote: { fechaVencimiento: 'asc' } },
  { claveControl: 'asc' },
];

@Injectable()
export class PrismaExistenciasRepositorio extends ExistenciasRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async listar(
    filtros: FiltrosExistencias,
    { pagina, limite }: Paginacion,
  ): Promise<ResultadoPaginado<Existencia>> {
    const where: Prisma.ExistenciaWhereInput = {
      ubicacionId: filtros.ubicacionId,
      insumoId: filtros.insumoId,
      cantidad: filtros.incluirAgotadas ? undefined : { gt: 0 },
      ubicacion: filtros.tipoUbicacion
        ? { tipo: filtros.tipoUbicacion }
        : undefined,
      insumo: {
        tipo: filtros.tipoInsumo,
        OR: filtros.busqueda
          ? [
              { codigo: { contains: filtros.busqueda } },
              { nombre: { contains: filtros.busqueda } },
            ]
          : undefined,
      },
    };
    const [total, registros] = await this.prisma.$transaction([
      this.prisma.existencia.count({ where }),
      this.prisma.existencia.findMany({
        where,
        select: seleccionExistencia,
        orderBy: ORDEN,
        skip: (pagina - 1) * limite,
        take: limite,
      }),
    ]);
    return { datos: registros.map(aExistencia), total, pagina, limite };
  }

  async deUbicacion(ubicacionId: string): Promise<Existencia[]> {
    const registros = await this.prisma.existencia.findMany({
      where: { ubicacionId, cantidad: { gt: 0 } },
      select: seleccionExistencia,
      orderBy: ORDEN,
    });
    return registros.map(aExistencia);
  }

  async cantidadEn(ubicacionId: string, claveControl: string): Promise<number> {
    const registro = await this.prisma.existencia.findUnique({
      where: { ubicacionId_claveControl: { ubicacionId, claveControl } },
      select: { cantidad: true },
    });
    return registro ? aNumero(registro.cantidad) : 0;
  }
}
