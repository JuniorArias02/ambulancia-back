import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service.js';
import type { Prisma } from '../../../../generated/prisma/client.js';
import {
  TIPOS_UBICACION,
  UbicacionInventario,
} from '../../domain/entities/ubicacion_inventario.entity.js';
import {
  type FiltrosUbicaciones,
  UbicacionesInventarioRepositorio,
} from '../../domain/repositories/ubicaciones_inventario.repository.js';
import {
  esDuplicado,
  nombreUbicacion,
  seleccionNombreUbicacion,
  valorConocido,
} from './conversiones.js';

const seleccion = {
  id: true,
  tipo: true,
  bodegaId: true,
  ambulanciaId: true,
  activa: true,
  creadaEn: true,
  ...seleccionNombreUbicacion,
} satisfies Prisma.UbicacionInventarioSelect;

type Registro = Prisma.UbicacionInventarioGetPayload<{
  select: typeof seleccion;
}>;

@Injectable()
export class PrismaUbicacionesInventarioRepositorio extends UbicacionesInventarioRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async buscarPorId(id: string): Promise<UbicacionInventario | null> {
    const registro = await this.prisma.ubicacionInventario.findUnique({
      where: { id },
      select: seleccion,
    });
    return registro ? this.aEntidad(registro) : null;
  }

  async buscarDeAmbulancia(
    ambulanciaId: string,
  ): Promise<UbicacionInventario | null> {
    const registro = await this.prisma.ubicacionInventario.findUnique({
      where: { ambulanciaId },
      select: seleccion,
    });
    return registro ? this.aEntidad(registro) : null;
  }

  async asegurarDeAmbulancia(
    ubicacion: UbicacionInventario,
  ): Promise<{ ubicacion: UbicacionInventario; creada: boolean }> {
    const ambulanciaId = ubicacion.ambulanciaId;
    if (!ambulanciaId) throw new Error('La ubicación no es de una ambulancia');
    const existente = await this.buscarDeAmbulancia(ambulanciaId);
    if (existente) return { ubicacion: existente, creada: false };
    try {
      const registro = await this.prisma.ubicacionInventario.create({
        data: {
          id: ubicacion.id,
          tipo: ubicacion.tipo,
          ambulanciaId,
          activa: ubicacion.activa,
          creadaEn: ubicacion.creadaEn,
        },
        select: seleccion,
      });
      return { ubicacion: this.aEntidad(registro), creada: true };
    } catch (error) {
      // Dos solicitudes a la vez: el índice único de ambulancia_id deja pasar una.
      if (esDuplicado(error)) {
        const ganadora = await this.buscarDeAmbulancia(ambulanciaId);
        if (ganadora) return { ubicacion: ganadora, creada: false };
      }
      throw error;
    }
  }

  async listar(filtros: FiltrosUbicaciones): Promise<UbicacionInventario[]> {
    const registros = await this.prisma.ubicacionInventario.findMany({
      where: { tipo: filtros.tipo, activa: filtros.activa },
      select: seleccion,
      orderBy: [{ tipo: 'desc' }, { creadaEn: 'asc' }],
    });
    return registros.map((r) => this.aEntidad(r));
  }

  async cambiarEstado(
    ubicacion: UbicacionInventario,
  ): Promise<UbicacionInventario> {
    const registro = await this.prisma.ubicacionInventario.update({
      where: { id: ubicacion.id },
      data: { activa: ubicacion.activa },
      select: seleccion,
    });
    return this.aEntidad(registro);
  }

  private aEntidad(registro: Registro): UbicacionInventario {
    return UbicacionInventario.reconstruir({
      id: registro.id,
      tipo: valorConocido(
        TIPOS_UBICACION,
        registro.tipo,
        'inv_ubicaciones.tipo',
      ),
      bodegaId: registro.bodegaId,
      ambulanciaId: registro.ambulanciaId,
      activa: registro.activa,
      creadaEn: registro.creadaEn,
      nombre: nombreUbicacion(registro),
    });
  }
}
