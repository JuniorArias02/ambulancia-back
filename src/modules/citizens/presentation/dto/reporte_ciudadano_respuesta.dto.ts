import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ResultadoPaginado } from '../../../../common/types/resultado_paginado.js';
import {
  type Emergencia,
  ESTADOS_EMERGENCIA,
  type EstadoEmergencia,
  ORIGENES_UBICACION,
  type OrigenUbicacion,
  TIPOS_INCIDENTE,
  type TipoIncidente,
} from '../../../emergencies/domain/entities/emergencia.entity.js';
import { admiteSeguimiento } from '../../domain/services/seguimiento_ambulancia.js';

class CoordenadasReporteDto {
  @ApiProperty({ example: 7.893906 })
  latitud: number;

  @ApiProperty({ example: -72.507782 })
  longitud: number;
}

/**
 * Lo que el ciudadano ve de su propio reporte: sin prioridad, sin quién lo
 * gestionó en la central y sin datos de otros reportes.
 */
export class ReporteCiudadanoRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'EMG-20261102-0007' })
  numeroEmergencia: string;

  @ApiPropertyOptional({ enum: TIPOS_INCIDENTE, nullable: true })
  tipoIncidente: TipoIncidente | null;

  @ApiProperty()
  descripcion: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'La que encontró el servidor; null si no se pudo resolver',
  })
  direccion: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  referenciaLugar: string | null;

  @ApiPropertyOptional({ type: CoordenadasReporteDto, nullable: true })
  coordenadas: CoordenadasReporteDto | null;

  @ApiPropertyOptional({ enum: ORIGENES_UBICACION, nullable: true })
  origenUbicacion: OrigenUbicacion | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  numeroVictimas: number | null;

  @ApiProperty({ enum: ESTADOS_EMERGENCIA })
  estado: EstadoEmergencia;

  @ApiProperty({
    description:
      'La central lo unió a otro reporte del mismo incidente; se atiende allí',
  })
  unidoAOtroReporte: boolean;

  @ApiProperty({
    description:
      'Hay una ambulancia en camino al lugar: mostrar "Ver ambulancia" (GET /ciudadanos/emergencias/{id}/seguimiento)',
  })
  seguimientoDisponible: boolean;

  @ApiProperty({ description: 'Cuándo se recibió el reporte' })
  recibidaEn: Date;

  @ApiPropertyOptional({ type: Date, nullable: true })
  cerradaEn: Date | null;

  static desde(emergencia: Emergencia): ReporteCiudadanoRespuestaDto {
    return camposReporte(emergencia);
  }
}

function camposReporte(emergencia: Emergencia) {
  return {
    id: emergencia.id,
    numeroEmergencia: emergencia.numeroEmergencia,
    tipoIncidente: emergencia.tipoIncidente,
    descripcion: emergencia.descripcion,
    direccion: emergencia.direccion,
    referenciaLugar: emergencia.referenciaLugar,
    coordenadas: emergencia.coordenadas,
    origenUbicacion: emergencia.origenUbicacion,
    numeroVictimas: emergencia.numeroVictimas,
    estado: emergencia.estado,
    unidoAOtroReporte: emergencia.esDuplicada(),
    seguimientoDisponible: admiteSeguimiento(emergencia.estado),
    recibidaEn: emergencia.recibidaEn,
    cerradaEn: emergencia.cerradaEn,
  };
}

export class ReporteRegistradoRespuestaDto extends ReporteCiudadanoRespuestaDto {
  @ApiProperty({
    description: 'false si era un reintento de un reporte ya recibido',
  })
  creado: boolean;

  static desdeRegistro(
    emergencia: Emergencia,
    creado: boolean,
  ): ReporteRegistradoRespuestaDto {
    return { ...camposReporte(emergencia), creado };
  }
}

export class ReportesPaginadosRespuestaDto {
  @ApiProperty({ type: [ReporteCiudadanoRespuestaDto] })
  datos: ReporteCiudadanoRespuestaDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  pagina: number;

  @ApiProperty()
  limite: number;

  static desde(
    resultado: ResultadoPaginado<Emergencia>,
  ): ReportesPaginadosRespuestaDto {
    return {
      ...resultado,
      datos: resultado.datos.map((e) => ReporteCiudadanoRespuestaDto.desde(e)),
    };
  }
}
