import { Injectable } from '@nestjs/common';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import { PrismaService } from '../../../../database/prisma.service.js';
import type { Prisma } from '../../../../generated/prisma/client.js';
import {
  Equipo,
  ESTADOS_EQUIPO,
  type Mantenimiento,
  TIPOS_MANTENIMIENTO,
} from '../../domain/entities/equipo.entity.js';
import {
  EquiposRepositorio,
  type FiltrosEquipos,
} from '../../domain/repositories/equipos.repository.js';
import {
  aFechaBd,
  deFechaBd,
  siDuplicado,
  valorConocido,
} from './conversiones.js';

const seleccion = {
  id: true,
  insumoId: true,
  registroSanitarioId: true,
  numeroSerie: true,
  marca: true,
  modelo: true,
  fechaAdquisicion: true,
  estado: true,
  fechaUltimoMantenimiento: true,
  fechaProximoMantenimiento: true,
  observaciones: true,
  creadoEn: true,
  actualizadoEn: true,
  insumo: { select: { nombre: true } },
} satisfies Prisma.EquipoSelect;

type Registro = Prisma.EquipoGetPayload<{ select: typeof seleccion }>;
type RegistroMantenimiento = Prisma.MantenimientoGetPayload<object>;

@Injectable()
export class PrismaEquiposRepositorio extends EquiposRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async buscarPorId(id: string): Promise<Equipo | null> {
    const registro = await this.prisma.equipo.findUnique({
      where: { id },
      select: seleccion,
    });
    return registro ? this.aEntidad(registro) : null;
  }

  async buscarVarios(ids: readonly string[]): Promise<Equipo[]> {
    if (ids.length === 0) return [];
    const registros = await this.prisma.equipo.findMany({
      where: { id: { in: [...ids] } },
      select: seleccion,
    });
    return registros.map((r) => this.aEntidad(r));
  }

  async existeSerie(numeroSerie: string): Promise<boolean> {
    return (await this.prisma.equipo.count({ where: { numeroSerie } })) > 0;
  }

  async listar(
    filtros: FiltrosEquipos,
    { pagina, limite }: Paginacion,
  ): Promise<ResultadoPaginado<Equipo>> {
    const where: Prisma.EquipoWhereInput = {
      insumoId: filtros.insumoId,
      estado: filtros.estado,
      fechaProximoMantenimiento: filtros.mantenimientoHasta
        ? { lte: aFechaBd(filtros.mantenimientoHasta) }
        : undefined,
      OR: filtros.busqueda
        ? [
            { numeroSerie: { contains: filtros.busqueda } },
            { modelo: { contains: filtros.busqueda } },
            { insumo: { nombre: { contains: filtros.busqueda } } },
          ]
        : undefined,
    };
    const [total, registros] = await this.prisma.$transaction([
      this.prisma.equipo.count({ where }),
      this.prisma.equipo.findMany({
        where,
        select: seleccion,
        orderBy: { numeroSerie: 'asc' },
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

  async crear(equipo: Equipo): Promise<Equipo> {
    const registro = await siDuplicado(
      () =>
        this.prisma.equipo.create({
          data: {
            id: equipo.id,
            insumoId: equipo.insumoId,
            registroSanitarioId: equipo.registroSanitarioId,
            numeroSerie: equipo.numeroSerie,
            creadoEn: equipo.creadoEn,
            ...this.datos(equipo),
          },
          select: seleccion,
        }),
      `Ya existe un equipo con la serie ${equipo.numeroSerie}`,
    );
    return this.aEntidad(registro);
  }

  async actualizar(equipo: Equipo): Promise<Equipo> {
    const registro = await this.prisma.equipo.update({
      where: { id: equipo.id },
      data: this.datos(equipo),
      select: seleccion,
    });
    return this.aEntidad(registro);
  }

  async registrarMantenimiento(
    equipo: Equipo,
    mantenimiento: Mantenimiento,
  ): Promise<Equipo> {
    const [, registro] = await this.prisma.$transaction([
      this.prisma.mantenimiento.create({
        data: {
          ...mantenimiento,
          fechaMantenimiento: aFechaBd(mantenimiento.fechaMantenimiento),
          fechaProximo: aFechaBd(mantenimiento.fechaProximo),
        },
      }),
      this.prisma.equipo.update({
        where: { id: equipo.id },
        data: this.datos(equipo),
        select: seleccion,
      }),
    ]);
    return this.aEntidad(registro);
  }

  async listarMantenimientos(equipoId: string): Promise<Mantenimiento[]> {
    const registros = await this.prisma.mantenimiento.findMany({
      where: { equipoId },
      orderBy: [{ fechaMantenimiento: 'desc' }, { creadoEn: 'desc' }],
    });
    return registros.map((r) => this.aMantenimiento(r));
  }

  private datos(equipo: Equipo) {
    return {
      marca: equipo.marca,
      modelo: equipo.modelo,
      fechaAdquisicion: aFechaBd(equipo.fechaAdquisicion),
      estado: equipo.estado,
      fechaUltimoMantenimiento: aFechaBd(equipo.fechaUltimoMantenimiento),
      fechaProximoMantenimiento: aFechaBd(equipo.fechaProximoMantenimiento),
      observaciones: equipo.observaciones,
    };
  }

  private aMantenimiento(registro: RegistroMantenimiento): Mantenimiento {
    return {
      ...registro,
      tipo: valorConocido(
        TIPOS_MANTENIMIENTO,
        registro.tipo,
        'inv_mantenimientos.tipo',
      ),
      fechaMantenimiento: deFechaBd(registro.fechaMantenimiento),
      fechaProximo: deFechaBd(registro.fechaProximo),
    };
  }

  private aEntidad(registro: Registro): Equipo {
    return Equipo.reconstruir({
      id: registro.id,
      insumoId: registro.insumoId,
      registroSanitarioId: registro.registroSanitarioId,
      numeroSerie: registro.numeroSerie,
      marca: registro.marca,
      modelo: registro.modelo,
      fechaAdquisicion: deFechaBd(registro.fechaAdquisicion),
      estado: valorConocido(
        ESTADOS_EQUIPO,
        registro.estado,
        'inv_equipos.estado',
      ),
      fechaUltimoMantenimiento: deFechaBd(registro.fechaUltimoMantenimiento),
      fechaProximoMantenimiento: deFechaBd(registro.fechaProximoMantenimiento),
      observaciones: registro.observaciones,
      creadoEn: registro.creadoEn,
      actualizadoEn: registro.actualizadoEn,
      insumoNombre: registro.insumo.nombre,
    });
  }
}
