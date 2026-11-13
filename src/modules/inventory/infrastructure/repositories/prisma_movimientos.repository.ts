import { Injectable } from '@nestjs/common';
import { ConflictoNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import { PrismaService } from '../../../../database/prisma.service.js';
import { Prisma } from '../../../../generated/prisma/client.js';
import { ESTADOS_EQUIPO } from '../../domain/entities/equipo.entity.js';
import {
  ESTADOS_MOVIMIENTO,
  Movimiento,
  TIPOS_MOVIMIENTO,
  type UbicacionMovimiento,
} from '../../domain/entities/movimiento.entity.js';
import { TIPOS_UBICACION } from '../../domain/entities/ubicacion_inventario.entity.js';
import { claveControl } from '../../domain/services/identificacion_unidad.js';
import {
  type FiltrosMovimientos,
  MovimientosRepositorio,
} from '../../domain/repositories/movimientos.repository.js';
import {
  aNumero,
  deFechaBd,
  nombreCompleto,
  nombreUbicacion,
  rangoDiasColombia,
  seleccionNombreUbicacion,
  valorConocido,
} from './conversiones.js';

const seleccionUbicacion = {
  select: { id: true, tipo: true, activa: true, ...seleccionNombreUbicacion },
} satisfies Prisma.UbicacionInventarioDefaultArgs;

const seleccion = {
  id: true,
  codigo: true,
  tipo: true,
  estado: true,
  asignacionId: true,
  usuarioId: true,
  motivo: true,
  observaciones: true,
  documentoReferencia: true,
  realizadoEn: true,
  creadoEn: true,
  actualizadoEn: true,
  origen: seleccionUbicacion,
  destino: seleccionUbicacion,
  usuario: { select: { nombres: true, apellidos: true } },
  detalles: {
    select: {
      id: true,
      insumoId: true,
      loteId: true,
      equipoId: true,
      cantidad: true,
      observaciones: true,
      insumo: { select: { codigo: true, nombre: true, unidadMedida: true } },
      lote: { select: { numeroLote: true, fechaVencimiento: true } },
      equipo: { select: { numeroSerie: true, estado: true } },
    },
    orderBy: { insumo: { nombre: 'asc' } },
  },
} satisfies Prisma.MovimientoInventarioSelect;

type Registro = Prisma.MovimientoInventarioGetPayload<{
  select: typeof seleccion;
}>;
type RegistroUbicacion = Registro['origen'];

/** Dos confirmaciones que tocan las mismas existencias pueden chocar (deadlock): se reintenta. */
const INTENTOS_TRANSACCION = 3;

function esChoqueDeTransacciones(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2034'
  );
}

@Injectable()
export class PrismaMovimientosRepositorio extends MovimientosRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async buscarPorId(id: string): Promise<Movimiento | null> {
    const registro = await this.prisma.movimientoInventario.findUnique({
      where: { id },
      select: seleccion,
    });
    return registro ? this.aEntidad(registro) : null;
  }

  async registrar(movimiento: Movimiento): Promise<Movimiento> {
    await this.enTransaccion(async (tx) => {
      await tx.movimientoInventario.create({
        data: {
          id: movimiento.id,
          codigo: movimiento.codigo,
          tipo: movimiento.tipo,
          estado: movimiento.estado,
          origenUbicacionId: movimiento.origen?.id ?? null,
          destinoUbicacionId: movimiento.destino?.id ?? null,
          asignacionId: movimiento.asignacionId,
          usuarioId: movimiento.usuarioId,
          motivo: movimiento.motivo,
          observaciones: movimiento.observaciones,
          documentoReferencia: movimiento.documentoReferencia,
          realizadoEn: movimiento.realizadoEn,
          creadoEn: movimiento.creadoEn,
          detalles: {
            create: movimiento.lineas.map((linea) => ({
              id: linea.id,
              insumoId: linea.insumoId,
              loteId: linea.loteId,
              equipoId: linea.equipoId,
              cantidad: linea.cantidad,
              observaciones: linea.observaciones,
            })),
          },
        },
      });
      if (movimiento.estado === 'confirmado')
        await this.aplicar(tx, movimiento);
    });
    return this.recargar(movimiento.id);
  }

  async confirmar(movimiento: Movimiento): Promise<Movimiento> {
    await this.enTransaccion(async (tx) => {
      const { count } = await tx.movimientoInventario.updateMany({
        where: { id: movimiento.id, estado: 'borrador' },
        data: { estado: movimiento.estado },
      });
      if (count === 0) {
        throw new ConflictoNegocioError(
          'El movimiento ya no está en borrador; vuelva a consultarlo',
        );
      }
      await this.aplicar(tx, movimiento);
    });
    return this.recargar(movimiento.id);
  }

  async anular(movimiento: Movimiento): Promise<Movimiento> {
    const { count } = await this.prisma.movimientoInventario.updateMany({
      where: { id: movimiento.id, estado: 'borrador' },
      data: { estado: movimiento.estado },
    });
    if (count === 0) {
      throw new ConflictoNegocioError(
        'El movimiento ya no está en borrador; vuelva a consultarlo',
      );
    }
    return this.recargar(movimiento.id);
  }

  async listar(
    filtros: FiltrosMovimientos,
    { pagina, limite }: Paginacion,
  ): Promise<ResultadoPaginado<Movimiento>> {
    const where: Prisma.MovimientoInventarioWhereInput = {
      tipo: filtros.tipo,
      estado: filtros.estado,
      asignacionId: filtros.asignacionId,
      usuarioId: filtros.usuarioId,
      realizadoEn: rangoDiasColombia(filtros.desde, filtros.hasta),
      detalles: filtros.insumoId
        ? { some: { insumoId: filtros.insumoId } }
        : undefined,
      OR: filtros.ubicacionId
        ? [
            { origenUbicacionId: filtros.ubicacionId },
            { destinoUbicacionId: filtros.ubicacionId },
          ]
        : undefined,
    };
    const [total, registros] = await this.prisma.$transaction([
      this.prisma.movimientoInventario.count({ where }),
      this.prisma.movimientoInventario.findMany({
        where,
        select: seleccion,
        orderBy: [{ realizadoEn: 'desc' }, { creadoEn: 'desc' }],
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

  /**
   * Resta en el origen solo si alcanza (UPDATE condicionado: dos consumos
   * simultáneos no dejan la existencia negativa) y suma en el destino con un
   * INSERT … ON DUPLICATE KEY sobre (ubicacion_id, clave_control).
   */
  private async aplicar(
    tx: Prisma.TransactionClient,
    movimiento: Movimiento,
  ): Promise<void> {
    for (const efecto of movimiento.efectos()) {
      if (efecto.delta < 0) {
        const necesaria = -efecto.delta;
        const { count } = await tx.existencia.updateMany({
          where: {
            ubicacionId: efecto.ubicacionId,
            claveControl: efecto.claveControl,
            cantidad: { gte: necesaria },
          },
          data: { cantidad: { decrement: necesaria } },
        });
        if (count === 0) {
          const actual = await tx.existencia.findUnique({
            where: {
              ubicacionId_claveControl: {
                ubicacionId: efecto.ubicacionId,
                claveControl: efecto.claveControl,
              },
            },
            select: { cantidad: true },
          });
          throw new ConflictoNegocioError(
            `No alcanza ${efecto.descripcion} en ${this.nombreDe(movimiento, efecto.ubicacionId)}: ` +
              `hay ${actual ? aNumero(actual.cantidad) : 0} y se necesitan ${necesaria}`,
          );
        }
      } else {
        await tx.$executeRaw`
          INSERT INTO inv_existencias
            (id, ubicacion_id, insumo_id, lote_id, equipo_id, clave_control, cantidad, actualizada_en)
          VALUES
            (${crypto.randomUUID()}, ${efecto.ubicacionId}, ${efecto.insumoId}, ${efecto.loteId},
             ${efecto.equipoId}, ${efecto.claveControl}, ${efecto.delta}, UTC_TIMESTAMP(3))
          ON DUPLICATE KEY UPDATE
            cantidad = cantidad + ${efecto.delta}, actualizada_en = UTC_TIMESTAMP(3)`;
      }
    }
    await this.exigirEquiposUnicos(tx, movimiento);
  }

  /** Un equipo es una sola unidad física: no puede quedar en dos ubicaciones. */
  private async exigirEquiposUnicos(
    tx: Prisma.TransactionClient,
    movimiento: Movimiento,
  ): Promise<void> {
    for (const linea of movimiento.lineas) {
      if (!linea.equipoId) continue;
      const { _sum } = await tx.existencia.aggregate({
        where: { equipoId: linea.equipoId },
        _sum: { cantidad: true },
      });
      if ((aNumero(_sum.cantidad) ?? 0) > 1) {
        throw new ConflictoNegocioError(
          `El equipo ${linea.numeroSerie ?? linea.equipoId} ya está en otra ubicación`,
        );
      }
    }
  }

  private async enTransaccion(
    trabajo: (tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<void> {
    for (let intento = 1; ; intento++) {
      try {
        await this.prisma.$transaction(trabajo);
        return;
      } catch (error) {
        if (
          !esChoqueDeTransacciones(error) ||
          intento >= INTENTOS_TRANSACCION
        ) {
          throw error;
        }
      }
    }
  }

  private nombreDe(movimiento: Movimiento, ubicacionId: string): string {
    const ubicacion = [movimiento.origen, movimiento.destino].find(
      (u) => u?.id === ubicacionId,
    );
    return ubicacion?.nombre ?? 'la ubicación';
  }

  private async recargar(id: string): Promise<Movimiento> {
    const registro = await this.prisma.movimientoInventario.findUniqueOrThrow({
      where: { id },
      select: seleccion,
    });
    return this.aEntidad(registro);
  }

  private aUbicacion(registro: RegistroUbicacion): UbicacionMovimiento | null {
    if (!registro) return null;
    return {
      id: registro.id,
      tipo: valorConocido(
        TIPOS_UBICACION,
        registro.tipo,
        'inv_ubicaciones.tipo',
      ),
      nombre: nombreUbicacion(registro),
      activa: registro.activa,
    };
  }

  private aEntidad(registro: Registro): Movimiento {
    return Movimiento.reconstruir({
      id: registro.id,
      codigo: registro.codigo,
      tipo: valorConocido(
        TIPOS_MOVIMIENTO,
        registro.tipo,
        'inv_movimientos.tipo',
      ),
      estado: valorConocido(
        ESTADOS_MOVIMIENTO,
        registro.estado,
        'inv_movimientos.estado',
      ),
      origen: this.aUbicacion(registro.origen),
      destino: this.aUbicacion(registro.destino),
      asignacionId: registro.asignacionId,
      usuarioId: registro.usuarioId,
      usuarioNombre: nombreCompleto(registro.usuario),
      motivo: registro.motivo,
      observaciones: registro.observaciones,
      documentoReferencia: registro.documentoReferencia,
      realizadoEn: registro.realizadoEn,
      creadoEn: registro.creadoEn,
      actualizadoEn: registro.actualizadoEn,
      lineas: registro.detalles.map((d) => ({
        id: d.id,
        insumoId: d.insumoId,
        loteId: d.loteId,
        equipoId: d.equipoId,
        claveControl: claveControl(d.insumoId, d.loteId, d.equipoId),
        cantidad: aNumero(d.cantidad),
        observaciones: d.observaciones,
        insumoCodigo: d.insumo.codigo,
        insumoNombre: d.insumo.nombre,
        unidadMedida: d.insumo.unidadMedida,
        numeroLote: d.lote?.numeroLote ?? null,
        loteVencimiento: deFechaBd(d.lote?.fechaVencimiento ?? null),
        numeroSerie: d.equipo?.numeroSerie ?? null,
        equipoEstado: d.equipo
          ? valorConocido(ESTADOS_EQUIPO, d.equipo.estado, 'inv_equipos.estado')
          : null,
      })),
    });
  }
}
