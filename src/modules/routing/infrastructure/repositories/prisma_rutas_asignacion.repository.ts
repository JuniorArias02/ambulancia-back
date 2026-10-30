import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service.js';
import type { Prisma } from '../../../../generated/prisma/client.js';
import type { PuntoGeografico } from '../../../../common/utils/geografia.js';
import {
  MOTIVOS_RUTA,
  RutaAsignacion,
  TRAMOS_RUTA,
} from '../../domain/entities/ruta_asignacion.entity.js';
import { RutasAsignacionRepositorio } from '../../domain/repositories/rutas_asignacion.repository.js';

const seleccionRuta = {
  id: true,
  asignacionId: true,
  tramo: true,
  motivo: true,
  origenLatitud: true,
  origenLongitud: true,
  destinoLatitud: true,
  destinoLongitud: true,
  geometria: true,
  distanciaMetros: true,
  duracionSegundos: true,
  proveedor: true,
  calculadaEn: true,
} satisfies Prisma.RutaAsignacionSelect;

type RegistroRuta = Prisma.RutaAsignacionGetPayload<{
  select: typeof seleccionRuta;
}>;

@Injectable()
export class PrismaRutasAsignacionRepositorio extends RutasAsignacionRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async guardar(ruta: RutaAsignacion): Promise<RutaAsignacion> {
    const registro = await this.prisma.rutaAsignacion.create({
      data: {
        id: ruta.id,
        asignacionId: ruta.asignacionId,
        tramo: ruta.tramo,
        motivo: ruta.motivo,
        origenLatitud: ruta.origen.latitud,
        origenLongitud: ruta.origen.longitud,
        destinoLatitud: ruta.destino.latitud,
        destinoLongitud: ruta.destino.longitud,
        // Orden GeoJSON [longitud, latitud]: el mismo que se entrega al frontend.
        geometria: ruta.geometria.map((p) => [p.longitud, p.latitud]),
        distanciaMetros: ruta.distanciaMetros,
        duracionSegundos: ruta.duracionSegundos,
        proveedor: ruta.proveedor,
        calculadaEn: ruta.calculadaEn,
      },
      select: seleccionRuta,
    });
    return this.aEntidad(registro);
  }

  async buscarVigente(asignacionId: string): Promise<RutaAsignacion | null> {
    const registro = await this.prisma.rutaAsignacion.findFirst({
      where: { asignacionId },
      orderBy: { calculadaEn: 'desc' },
      select: seleccionRuta,
    });
    return registro ? this.aEntidad(registro) : null;
  }

  async listarVigentes(
    asignacionIds: readonly string[],
  ): Promise<RutaAsignacion[]> {
    if (asignacionIds.length === 0) return [];
    const registros = await this.prisma.rutaAsignacion.findMany({
      where: { asignacionId: { in: [...asignacionIds] } },
      orderBy: { calculadaEn: 'desc' },
      // Con el orden descendente, `distinct` deja la más reciente de cada servicio.
      distinct: ['asignacionId'],
      select: seleccionRuta,
    });
    return registros.map((registro) => this.aEntidad(registro));
  }

  private aEntidad(registro: RegistroRuta): RutaAsignacion {
    const tramo = TRAMOS_RUTA.find((t) => t === registro.tramo);
    const motivo = MOTIVOS_RUTA.find((m) => m === registro.motivo);
    if (!tramo || !motivo) {
      throw new Error(
        `Ruta con tramo o motivo desconocido en la base de datos: ${registro.tramo}/${registro.motivo}`,
      );
    }
    return RutaAsignacion.reconstruir({
      id: registro.id,
      asignacionId: registro.asignacionId,
      tramo,
      motivo,
      origen: {
        latitud: registro.origenLatitud.toNumber(),
        longitud: registro.origenLongitud.toNumber(),
      },
      destino: {
        latitud: registro.destinoLatitud.toNumber(),
        longitud: registro.destinoLongitud.toNumber(),
      },
      geometria: leerGeometria(registro.geometria),
      distanciaMetros: registro.distanciaMetros,
      duracionSegundos: registro.duracionSegundos,
      proveedor: registro.proveedor,
      calculadaEn: registro.calculadaEn,
    });
  }
}

/** La columna JSON llega sin tipo: se valida cada par [longitud, latitud]. */
function leerGeometria(valor: Prisma.JsonValue): PuntoGeografico[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((par) =>
    Array.isArray(par) &&
    typeof par[0] === 'number' &&
    typeof par[1] === 'number'
      ? [{ longitud: par[0], latitud: par[1] }]
      : [],
  );
}
