import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service.js';
import type { Prisma } from '../../../../generated/prisma/client.js';
import { ESTADOS_GEOCODIFICACION } from '../../domain/entities/direccion_geocodificada.entity.js';
import { GeocodificacionInversa } from '../../domain/entities/geocodificacion_inversa.entity.js';
import { GeocodificacionesInversasRepositorio } from '../../domain/repositories/geocodificaciones_inversas.repository.js';
import { PRECISIONES_UBICACION } from '../../domain/services/precision_ubicacion.js';

const seleccionGeocodificacion = {
  id: true,
  clavePunto: true,
  latitudSolicitada: true,
  longitudSolicitada: true,
  direccion: true,
  lineaDireccion: true,
  calle: true,
  numero: true,
  barrio: true,
  ciudad: true,
  departamento: true,
  codigoPostal: true,
  pais: true,
  latitudDireccion: true,
  longitudDireccion: true,
  distanciaMetros: true,
  precision: true,
  proveedor: true,
  proveedorResultadoId: true,
  estado: true,
  creadaEn: true,
  actualizadaEn: true,
} satisfies Prisma.GeocodificacionInversaSelect;

type RegistroGeocodificacion = Prisma.GeocodificacionInversaGetPayload<{
  select: typeof seleccionGeocodificacion;
}>;

@Injectable()
export class PrismaGeocodificacionesInversasRepositorio extends GeocodificacionesInversasRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async buscarPorClave(
    clavePunto: string,
  ): Promise<GeocodificacionInversa | null> {
    const registro = await this.prisma.geocodificacionInversa.findUnique({
      where: { clavePunto },
      select: seleccionGeocodificacion,
    });
    return registro ? this.aEntidad(registro) : null;
  }

  async guardar(
    geocodificacion: GeocodificacionInversa,
  ): Promise<GeocodificacionInversa> {
    const { componentes, coordenadasDireccion, puntoSolicitado } =
      geocodificacion;
    const datos = {
      latitudSolicitada: puntoSolicitado.latitud,
      longitudSolicitada: puntoSolicitado.longitud,
      direccion: geocodificacion.direccion,
      lineaDireccion: geocodificacion.lineaDireccion,
      ...componentes,
      latitudDireccion: coordenadasDireccion?.latitud ?? null,
      longitudDireccion: coordenadasDireccion?.longitud ?? null,
      distanciaMetros: geocodificacion.distanciaMetros,
      precision: geocodificacion.precision,
      proveedor: geocodificacion.proveedor,
      proveedorResultadoId: geocodificacion.proveedorResultadoId,
      estado: geocodificacion.estado,
    };
    // upsert sobre la clave única: dos clics simultáneos no chocan.
    const registro = await this.prisma.geocodificacionInversa.upsert({
      where: { clavePunto: geocodificacion.clavePunto },
      create: {
        id: geocodificacion.id,
        clavePunto: geocodificacion.clavePunto,
        creadaEn: geocodificacion.creadaEn,
        ...datos,
      },
      update: datos,
      select: seleccionGeocodificacion,
    });
    return this.aEntidad(registro);
  }

  private aEntidad(registro: RegistroGeocodificacion): GeocodificacionInversa {
    const estado = ESTADOS_GEOCODIFICACION.find((e) => e === registro.estado);
    if (estado === undefined) {
      throw new Error(
        `Estado de geocodificación desconocido en la base de datos: ${registro.estado}`,
      );
    }
    return GeocodificacionInversa.reconstruir({
      id: registro.id,
      clavePunto: registro.clavePunto,
      puntoSolicitado: {
        latitud: registro.latitudSolicitada.toNumber(),
        longitud: registro.longitudSolicitada.toNumber(),
      },
      direccion: registro.direccion,
      lineaDireccion: registro.lineaDireccion,
      componentes: {
        calle: registro.calle,
        numero: registro.numero,
        barrio: registro.barrio,
        ciudad: registro.ciudad,
        departamento: registro.departamento,
        codigoPostal: registro.codigoPostal,
        pais: registro.pais,
      },
      coordenadasDireccion:
        registro.latitudDireccion !== null &&
        registro.longitudDireccion !== null
          ? {
              latitud: registro.latitudDireccion.toNumber(),
              longitud: registro.longitudDireccion.toNumber(),
            }
          : null,
      distanciaMetros: registro.distanciaMetros?.toNumber() ?? null,
      precision:
        PRECISIONES_UBICACION.find((p) => p === registro.precision) ?? null,
      proveedor: registro.proveedor,
      proveedorResultadoId: registro.proveedorResultadoId,
      estado,
      creadaEn: registro.creadaEn,
      actualizadaEn: registro.actualizadaEn,
    });
  }
}
