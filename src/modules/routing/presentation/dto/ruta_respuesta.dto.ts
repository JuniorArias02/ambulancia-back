import { ApiProperty } from '@nestjs/swagger';
import type { RutaDeAsignacion } from '../../application/use-cases/obtener_ruta_asignacion.use-case.js';
import {
  MOTIVOS_RUTA,
  type MotivoRuta,
  TRAMOS_RUTA,
  type TramoRuta,
} from '../../domain/entities/ruta_asignacion.entity.js';

class PuntoRutaDto {
  @ApiProperty({ example: 7.8939 })
  latitud: number;

  @ApiProperty({ example: -72.5078 })
  longitud: number;
}

/** GeoJSON estándar: Leaflet (`L.geoJSON`), Mapbox y Google lo dibujan directo. */
export class LineaGeoJsonDto {
  @ApiProperty({ enum: ['LineString'] })
  type: 'LineString';

  @ApiProperty({
    type: 'array',
    items: { type: 'array', items: { type: 'number' } },
    example: [
      [-72.507726, 7.893516],
      [-72.507272, 7.893602],
    ],
    description:
      'Pares [longitud, latitud] (orden GeoJSON, ¡al revés que Leaflet!)',
  })
  coordinates: [number, number][];
}

export class RutaRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  asignacionId: string;

  @ApiProperty({ format: 'uuid' })
  ambulanciaId: string;

  @ApiProperty({ type: String, nullable: true, example: 'AMB-01' })
  ambulanciaCodigo: string | null;

  @ApiProperty({ format: 'uuid' })
  emergenciaId: string;

  @ApiProperty({ type: String, nullable: true, example: 'EMG-20261024-0004' })
  numeroEmergencia: string | null;

  @ApiProperty({ enum: TRAMOS_RUTA })
  tramo: TramoRuta;

  @ApiProperty({ enum: MOTIVOS_RUTA, description: 'Por qué se calculó' })
  motivo: MotivoRuta;

  @ApiProperty({
    type: PuntoRutaDto,
    description: 'Dónde estaba la ambulancia al calcular',
  })
  origen: PuntoRutaDto;

  @ApiProperty({
    type: PuntoRutaDto,
    description: 'La emergencia o el hospital, según el tramo',
  })
  destino: PuntoRutaDto;

  @ApiProperty({ type: LineaGeoJsonDto })
  geometria: LineaGeoJsonDto;

  @ApiProperty({ example: 2532 })
  distanciaMetros: number;

  @ApiProperty({ example: 229 })
  duracionSegundos: number;

  @ApiProperty({
    description: 'calculadaEn + duración (sin tráfico en tiempo real)',
  })
  llegadaEstimada: Date;

  @ApiProperty({ example: 'geoapify' })
  proveedor: string;

  @ApiProperty()
  calculadaEn: Date;

  static desde({ asignacion, ruta }: RutaDeAsignacion): RutaRespuestaDto {
    return {
      asignacionId: asignacion.id,
      ambulanciaId: asignacion.ambulanciaId,
      ambulanciaCodigo: asignacion.ambulanciaCodigo,
      emergenciaId: asignacion.emergenciaId,
      numeroEmergencia: asignacion.numeroEmergencia,
      tramo: ruta.tramo,
      motivo: ruta.motivo,
      origen: ruta.origen,
      destino: ruta.destino,
      geometria: {
        type: 'LineString',
        coordinates: ruta.geometria.map((p) => [p.longitud, p.latitud]),
      },
      distanciaMetros: ruta.distanciaMetros,
      duracionSegundos: ruta.duracionSegundos,
      llegadaEstimada: ruta.llegadaEstimada(),
      proveedor: ruta.proveedor,
      calculadaEn: ruta.calculadaEn,
    };
  }
}
