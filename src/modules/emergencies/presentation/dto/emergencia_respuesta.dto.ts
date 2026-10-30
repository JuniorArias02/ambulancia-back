import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ResultadoPaginado } from '../../../../common/types/resultado_paginado.js';
import {
  type Emergencia,
  ESTADOS_EMERGENCIA,
  type EstadoEmergencia,
  FUENTES_EMERGENCIA,
  type FuenteEmergencia,
  PRIORIDADES_EMERGENCIA,
  type PrioridadEmergencia,
  TIPOS_INCIDENTE,
  type TipoIncidente,
} from '../../domain/entities/emergencia.entity.js';
import type {
  CriterioCoincidencia,
  PosibleDuplicado,
} from '../../domain/services/criterios_duplicados.js';

export class CoordenadasRespuestaDto {
  @ApiProperty({ example: 4.6582 })
  latitud: number;

  @ApiProperty({ example: -74.0571 })
  longitud: number;
}

export class ReceptorRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Laura Gómez' })
  nombreCompleto: string | null;
}

export class EmergenciaRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'EMG-20261024-0001' })
  numeroEmergencia: string;

  @ApiProperty({ enum: FUENTES_EMERGENCIA })
  fuente: FuenteEmergencia;

  @ApiPropertyOptional({ type: String, nullable: true })
  informanteNombre: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  informanteTelefono: string | null;

  @ApiProperty()
  descripcion: string;

  @ApiPropertyOptional({ enum: TIPOS_INCIDENTE, nullable: true })
  tipoIncidente: TipoIncidente | null;

  @ApiPropertyOptional({ enum: PRIORIDADES_EMERGENCIA, nullable: true })
  prioridad: PrioridadEmergencia | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  direccion: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  referenciaLugar: string | null;

  @ApiPropertyOptional({ type: CoordenadasRespuestaDto, nullable: true })
  coordenadas: CoordenadasRespuestaDto | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  numeroVictimas: number | null;

  @ApiProperty({ enum: ESTADOS_EMERGENCIA })
  estado: EstadoEmergencia;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Si es duplicada, la emergencia que sí se atiende',
  })
  emergenciaPrincipalId: string | null;

  @ApiPropertyOptional({ type: ReceptorRespuestaDto, nullable: true })
  recibidaPor: ReceptorRespuestaDto | null;

  @ApiProperty()
  recibidaEn: Date;

  @ApiPropertyOptional({ type: Date, nullable: true })
  cerradaEn: Date | null;

  static desde(emergencia: Emergencia): EmergenciaRespuestaDto {
    return {
      id: emergencia.id,
      numeroEmergencia: emergencia.numeroEmergencia,
      fuente: emergencia.fuente,
      informanteNombre: emergencia.informanteNombre,
      informanteTelefono: emergencia.informanteTelefono,
      descripcion: emergencia.descripcion,
      tipoIncidente: emergencia.tipoIncidente,
      prioridad: emergencia.prioridad,
      direccion: emergencia.direccion,
      referenciaLugar: emergencia.referenciaLugar,
      coordenadas: emergencia.coordenadas,
      numeroVictimas: emergencia.numeroVictimas,
      estado: emergencia.estado,
      emergenciaPrincipalId: emergencia.emergenciaPrincipalId,
      recibidaPor: emergencia.recibidaPorId
        ? {
            id: emergencia.recibidaPorId,
            nombreCompleto: emergencia.recibidaPorNombre,
          }
        : null,
      recibidaEn: emergencia.recibidaEn,
      cerradaEn: emergencia.cerradaEn,
    };
  }
}

export class EmergenciasPaginadasRespuestaDto {
  @ApiProperty({ type: [EmergenciaRespuestaDto] })
  datos: EmergenciaRespuestaDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  pagina: number;

  @ApiProperty()
  limite: number;

  static desde(
    resultado: ResultadoPaginado<Emergencia>,
  ): EmergenciasPaginadasRespuestaDto {
    return {
      ...resultado,
      datos: resultado.datos.map((emergencia) =>
        EmergenciaRespuestaDto.desde(emergencia),
      ),
    };
  }
}

export class PosibleDuplicadaRespuestaDto {
  @ApiProperty({ type: EmergenciaRespuestaDto })
  emergencia: EmergenciaRespuestaDto;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'null si alguna de las dos no tiene coordenadas',
  })
  distanciaMetros: number | null;

  @ApiProperty({
    enum: ['cercania', 'misma_direccion', 'mismo_tipo'],
    isArray: true,
  })
  criterios: CriterioCoincidencia[];

  static desde(posible: PosibleDuplicado): PosibleDuplicadaRespuestaDto {
    return {
      emergencia: EmergenciaRespuestaDto.desde(posible.emergencia),
      distanciaMetros: posible.distanciaMetros,
      criterios: posible.criterios,
    };
  }
}
