import { Injectable } from '@nestjs/common';
import { ConflictoNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import { PrismaService } from '../../../../database/prisma.service.js';
import type { Prisma } from '../../../../generated/prisma/client.js';
import {
  ESTADOS_CONTEO,
  ESTADOS_VERIFICACION,
  TIPOS_VERIFICACION,
  Verificacion,
} from '../../domain/entities/verificacion.entity.js';
import {
  type FiltrosVerificaciones,
  VerificacionesRepositorio,
} from '../../domain/repositories/verificaciones.repository.js';
import { claveControl } from '../../domain/services/identificacion_unidad.js';
import {
  aNumero,
  nombreCompleto,
  nombreUbicacion,
  rangoDiasColombia,
  seleccionNombreUbicacion,
  valorConocido,
} from './conversiones.js';

const seleccion = {
  id: true,
  ubicacionId: true,
  turnoId: true,
  responsableId: true,
  tipo: true,
  estado: true,
  iniciadaEn: true,
  finalizadaEn: true,
  observaciones: true,
  revisadaPorId: true,
  revisadaEn: true,
  resolucion: true,
  ubicacion: { select: seleccionNombreUbicacion },
  responsable: { select: { nombres: true, apellidos: true } },
  revisadaPor: { select: { nombres: true, apellidos: true } },
  detalles: {
    select: {
      id: true,
      perfilDetalleId: true,
      insumoId: true,
      loteId: true,
      equipoId: true,
      cantidadEsperada: true,
      cantidadEncontrada: true,
      estado: true,
      observaciones: true,
      creadoEn: true,
      insumo: { select: { nombre: true } },
      lote: { select: { numeroLote: true } },
      equipo: { select: { numeroSerie: true } },
    },
    orderBy: [{ insumo: { nombre: 'asc' } }, { creadoEn: 'asc' }],
  },
} satisfies Prisma.VerificacionInventarioSelect;

type Registro = Prisma.VerificacionInventarioGetPayload<{
  select: typeof seleccion;
}>;

@Injectable()
export class PrismaVerificacionesRepositorio extends VerificacionesRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async buscarPorId(id: string): Promise<Verificacion | null> {
    const registro = await this.prisma.verificacionInventario.findUnique({
      where: { id },
      select: seleccion,
    });
    return registro ? this.aEntidad(registro) : null;
  }

  async buscarBorradorDeUbicacion(
    ubicacionId: string,
  ): Promise<Verificacion | null> {
    const registro = await this.prisma.verificacionInventario.findFirst({
      where: { ubicacionId, estado: 'borrador' },
      select: seleccion,
      orderBy: { iniciadaEn: 'desc' },
    });
    return registro ? this.aEntidad(registro) : null;
  }

  async crear(
    verificacion: Verificacion,
  ): Promise<{ verificacion: Verificacion; creada: boolean }> {
    const id = await this.prisma.$transaction(async (tx) => {
      // Sin índice que lo garantice, el bloqueo de la ubicación serializa los "iniciar".
      await tx.$queryRaw`SELECT id FROM inv_ubicaciones WHERE id = ${verificacion.ubicacionId} FOR UPDATE`;
      const abierta = await tx.verificacionInventario.findFirst({
        where: { ubicacionId: verificacion.ubicacionId, estado: 'borrador' },
        select: { id: true },
      });
      if (abierta) return { id: abierta.id, creada: false };
      await tx.verificacionInventario.create({
        data: {
          id: verificacion.id,
          ubicacionId: verificacion.ubicacionId,
          turnoId: verificacion.turnoId,
          responsableId: verificacion.responsableId,
          tipo: verificacion.tipo,
          estado: verificacion.estado,
          iniciadaEn: verificacion.iniciadaEn,
          observaciones: verificacion.observaciones,
        },
      });
      return { id: verificacion.id, creada: true };
    });
    return { verificacion: await this.recargar(id.id), creada: id.creada };
  }

  async guardarConteos(verificacion: Verificacion): Promise<Verificacion> {
    await this.prisma.$transaction(async (tx) => {
      const filas = await tx.$queryRaw<{ estado: string }[]>`
        SELECT estado FROM inv_verificaciones WHERE id = ${verificacion.id} FOR UPDATE`;
      if (filas[0]?.estado !== 'borrador') {
        throw new ConflictoNegocioError(
          'La verificación ya fue finalizada; vuelva a consultarla',
        );
      }
      for (const conteo of verificacion.conteos) {
        // Una sola fila por unidad: si otra solicitud ya la contó, se reemplaza.
        await tx.detalleVerificacion.deleteMany({
          where: {
            verificacionId: verificacion.id,
            insumoId: conteo.insumoId,
            loteId: conteo.loteId,
            equipoId: conteo.equipoId,
            id: { not: conteo.id },
          },
        });
        const datos = {
          perfilDetalleId: conteo.perfilDetalleId,
          cantidadEsperada: conteo.cantidadEsperada,
          cantidadEncontrada: conteo.cantidadEncontrada,
          estado: conteo.estado,
          observaciones: conteo.observaciones,
        };
        await tx.detalleVerificacion.upsert({
          where: { id: conteo.id },
          create: {
            id: conteo.id,
            verificacionId: verificacion.id,
            insumoId: conteo.insumoId,
            loteId: conteo.loteId,
            equipoId: conteo.equipoId,
            creadoEn: conteo.creadoEn,
            ...datos,
          },
          update: datos,
        });
      }
    });
    return this.recargar(verificacion.id);
  }

  async finalizar(verificacion: Verificacion): Promise<Verificacion> {
    const { count } = await this.prisma.verificacionInventario.updateMany({
      where: { id: verificacion.id, estado: 'borrador' },
      data: {
        estado: verificacion.estado,
        finalizadaEn: verificacion.finalizadaEn,
        observaciones: verificacion.observaciones,
      },
    });
    if (count === 0) {
      throw new ConflictoNegocioError(
        'La verificación ya fue finalizada; vuelva a consultarla',
      );
    }
    return this.recargar(verificacion.id);
  }

  async revisar(verificacion: Verificacion): Promise<Verificacion> {
    const revision = verificacion.revision;
    if (!revision) throw new Error('La verificación no trae revisión');
    const { count } = await this.prisma.verificacionInventario.updateMany({
      where: { id: verificacion.id, estado: 'con_novedades', revisadaEn: null },
      data: {
        revisadaPorId: revision.revisadaPorId,
        revisadaEn: revision.revisadaEn,
        resolucion: revision.resolucion,
      },
    });
    if (count === 0) {
      throw new ConflictoNegocioError(
        'La verificación ya fue revisada; vuelva a consultarla',
      );
    }
    return this.recargar(verificacion.id);
  }

  async listar(
    filtros: FiltrosVerificaciones,
    { pagina, limite }: Paginacion,
  ): Promise<ResultadoPaginado<Verificacion>> {
    const where: Prisma.VerificacionInventarioWhereInput = {
      ubicacionId: filtros.ubicacionId,
      responsableId: filtros.responsableId,
      estado: filtros.estado,
      tipo: filtros.tipo,
      iniciadaEn: rangoDiasColombia(filtros.desde, filtros.hasta),
      ...this.filtroRevision(filtros.revisada),
    };
    const [total, registros] = await this.prisma.$transaction([
      this.prisma.verificacionInventario.count({ where }),
      this.prisma.verificacionInventario.findMany({
        where,
        select: seleccion,
        orderBy: { iniciadaEn: 'desc' },
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

  /** Solo tiene sentido sobre las que tienen novedades. */
  private filtroRevision(
    revisada: boolean | undefined,
  ): Prisma.VerificacionInventarioWhereInput {
    if (revisada === undefined) return {};
    return {
      estado: 'con_novedades',
      revisadaEn: revisada ? { not: null } : null,
    };
  }

  private async recargar(id: string): Promise<Verificacion> {
    const registro = await this.prisma.verificacionInventario.findUniqueOrThrow(
      {
        where: { id },
        select: seleccion,
      },
    );
    return this.aEntidad(registro);
  }

  private aEntidad(registro: Registro): Verificacion {
    return Verificacion.reconstruir({
      id: registro.id,
      ubicacionId: registro.ubicacionId,
      ubicacionNombre: nombreUbicacion(registro.ubicacion),
      turnoId: registro.turnoId,
      responsableId: registro.responsableId,
      responsableNombre: nombreCompleto(registro.responsable),
      tipo: valorConocido(
        TIPOS_VERIFICACION,
        registro.tipo,
        'inv_verificaciones.tipo',
      ),
      estado: valorConocido(
        ESTADOS_VERIFICACION,
        registro.estado,
        'inv_verificaciones.estado',
      ),
      iniciadaEn: registro.iniciadaEn,
      finalizadaEn: registro.finalizadaEn,
      observaciones: registro.observaciones,
      // La revisión existe si tiene fecha; el revisor podría quedar en NULL por la FK.
      revision: registro.revisadaEn
        ? {
            revisadaPorId: registro.revisadaPorId,
            revisadaEn: registro.revisadaEn,
            resolucion: registro.resolucion ?? '',
            revisadaPorNombre: nombreCompleto(registro.revisadaPor),
          }
        : null,
      conteos: registro.detalles.map((d) => ({
        id: d.id,
        perfilDetalleId: d.perfilDetalleId,
        insumoId: d.insumoId,
        loteId: d.loteId,
        equipoId: d.equipoId,
        claveControl: claveControl(d.insumoId, d.loteId, d.equipoId),
        cantidadEsperada: aNumero(d.cantidadEsperada),
        cantidadEncontrada: aNumero(d.cantidadEncontrada),
        estado: valorConocido(
          ESTADOS_CONTEO,
          d.estado,
          'inv_verificacion_detalles.estado',
        ),
        observaciones: d.observaciones,
        creadoEn: d.creadoEn,
        insumoNombre: d.insumo.nombre,
        numeroLote: d.lote?.numeroLote ?? null,
        numeroSerie: d.equipo?.numeroSerie ?? null,
      })),
    });
  }
}
