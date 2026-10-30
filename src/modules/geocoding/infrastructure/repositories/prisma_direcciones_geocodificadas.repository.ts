import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service.js';
import type { Prisma } from '../../../../generated/prisma/client.js';
import {
  DireccionGeocodificada,
  ESTADOS_GEOCODIFICACION,
} from '../../domain/entities/direccion_geocodificada.entity.js';
import { DireccionesGeocodificadasRepositorio } from '../../domain/repositories/direcciones_geocodificadas.repository.js';

const seleccionDireccion = {
  id: true,
  direccionOriginal: true,
  direccionNormalizada: true,
  ciudad: true,
  direccionFormateada: true,
  latitud: true,
  longitud: true,
  proveedor: true,
  proveedorResultadoId: true,
  confianza: true,
  estado: true,
  creadaEn: true,
  actualizadaEn: true,
} satisfies Prisma.DireccionGeocodificadaSelect;

type RegistroDireccion = Prisma.DireccionGeocodificadaGetPayload<{
  select: typeof seleccionDireccion;
}>;

@Injectable()
export class PrismaDireccionesGeocodificadasRepositorio extends DireccionesGeocodificadasRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async buscarPorClave(
    direccionNormalizada: string,
  ): Promise<DireccionGeocodificada | null> {
    const registro = await this.prisma.direccionGeocodificada.findUnique({
      where: { direccionNormalizada },
      select: seleccionDireccion,
    });
    return registro ? this.aEntidad(registro) : null;
  }

  async guardar(
    direccion: DireccionGeocodificada,
  ): Promise<DireccionGeocodificada> {
    const datos = {
      direccionOriginal: direccion.direccionOriginal,
      ciudad: direccion.ciudad,
      direccionFormateada: direccion.direccionFormateada,
      latitud: direccion.coordenadas?.latitud ?? null,
      longitud: direccion.coordenadas?.longitud ?? null,
      proveedor: direccion.proveedor,
      proveedorResultadoId: direccion.proveedorResultadoId,
      confianza: direccion.confianza,
      estado: direccion.estado,
    };
    // upsert sobre la clave única: si dos instancias guardan la misma
    // dirección a la vez, no hay error de duplicado.
    const registro = await this.prisma.direccionGeocodificada.upsert({
      where: { direccionNormalizada: direccion.direccionNormalizada },
      create: {
        id: direccion.id,
        direccionNormalizada: direccion.direccionNormalizada,
        creadaEn: direccion.creadaEn,
        ...datos,
      },
      update: datos,
      select: seleccionDireccion,
    });
    return this.aEntidad(registro);
  }

  private aEntidad(registro: RegistroDireccion): DireccionGeocodificada {
    const estado = ESTADOS_GEOCODIFICACION.find((e) => e === registro.estado);
    if (estado === undefined) {
      throw new Error(
        `Estado de geocodificación desconocido en la base de datos: ${registro.estado}`,
      );
    }
    return DireccionGeocodificada.reconstruir({
      id: registro.id,
      direccionOriginal: registro.direccionOriginal,
      direccionNormalizada: registro.direccionNormalizada,
      ciudad: registro.ciudad,
      direccionFormateada: registro.direccionFormateada,
      coordenadas:
        registro.latitud !== null && registro.longitud !== null
          ? {
              latitud: registro.latitud.toNumber(),
              longitud: registro.longitud.toNumber(),
            }
          : null,
      proveedor: registro.proveedor,
      proveedorResultadoId: registro.proveedorResultadoId,
      confianza: registro.confianza?.toNumber() ?? null,
      estado,
      creadaEn: registro.creadaEn,
      actualizadaEn: registro.actualizadaEn,
    });
  }
}
