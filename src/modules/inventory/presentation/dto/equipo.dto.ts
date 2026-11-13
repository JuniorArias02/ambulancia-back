import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginacionDto } from '../../../../common/dto/paginacion.dto.js';
import type { ResultadoPaginado } from '../../../../common/types/resultado_paginado.js';
import {
  type Equipo,
  ESTADOS_EQUIPO,
  type EstadoEquipo,
  type Mantenimiento,
  TIPOS_MANTENIMIENTO,
  type TipoMantenimiento,
} from '../../domain/entities/equipo.entity.js';
import { EsFecha, PaginaRespuestaDto } from './validadores.js';

export class ActualizarEquipoDto {
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  marca?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  modelo?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '2025-03-01' })
  @IsOptional()
  @EsFecha()
  fechaAdquisicion?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '2026-12-01' })
  @IsOptional()
  @EsFecha()
  fechaProximoMantenimiento?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  observaciones?: string | null;
}

export class CrearEquipoDto extends ActualizarEquipoDto {
  @ApiProperty({ format: 'uuid', description: 'Insumo controlado por serie' })
  @IsUUID()
  insumoId: string;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  registroSanitarioId?: string | null;

  @ApiProperty({ maxLength: 100, example: 'DEA-ZOLL-00123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  numeroSerie: string;
}

export class CambiarEstadoEquipoDto {
  @ApiProperty({ enum: ESTADOS_EQUIPO, description: '"baja" es definitiva' })
  @IsIn(ESTADOS_EQUIPO)
  estado: EstadoEquipo;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  motivo?: string | null;
}

export class RegistrarMantenimientoDto {
  @ApiProperty({ enum: TIPOS_MANTENIMIENTO })
  @IsIn(TIPOS_MANTENIMIENTO)
  tipo: TipoMantenimiento;

  @ApiProperty({ example: '2026-11-10', description: 'No futura' })
  @EsFecha()
  fechaMantenimiento: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '2027-05-10',
    description: 'Posterior a la del mantenimiento',
  })
  @IsOptional()
  @EsFecha()
  fechaProximo?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  responsable?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  proveedor?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  documentoSoporte?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 50,
    example: 'aprobado',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  resultado?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  observaciones?: string | null;
}

export class ConsultarEquiposDto extends PaginacionDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  insumoId?: string;

  @ApiPropertyOptional({ enum: ESTADOS_EQUIPO })
  @IsOptional()
  @IsIn(ESTADOS_EQUIPO)
  estado?: EstadoEquipo;

  @ApiPropertyOptional({ description: 'Serie, modelo o nombre del insumo' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  busqueda?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Próximo mantenimiento hasta esta fecha',
  })
  @IsOptional()
  @EsFecha()
  mantenimientoHasta?: string;
}

export class EquipoRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  insumoId: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  insumoNombre: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' })
  registroSanitarioId: string | null;

  @ApiProperty()
  numeroSerie: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  marca: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  modelo: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  fechaAdquisicion: string | null;

  @ApiProperty({ enum: ESTADOS_EQUIPO })
  estado: EstadoEquipo;

  @ApiPropertyOptional({ type: String, nullable: true })
  fechaUltimoMantenimiento: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  fechaProximoMantenimiento: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  observaciones: string | null;

  @ApiProperty()
  creadoEn: Date;

  @ApiProperty()
  actualizadoEn: Date;

  static desde(equipo: Equipo): EquipoRespuestaDto {
    return {
      id: equipo.id,
      insumoId: equipo.insumoId,
      insumoNombre: equipo.insumoNombre,
      registroSanitarioId: equipo.registroSanitarioId,
      numeroSerie: equipo.numeroSerie,
      marca: equipo.marca,
      modelo: equipo.modelo,
      fechaAdquisicion: equipo.fechaAdquisicion,
      estado: equipo.estado,
      fechaUltimoMantenimiento: equipo.fechaUltimoMantenimiento,
      fechaProximoMantenimiento: equipo.fechaProximoMantenimiento,
      observaciones: equipo.observaciones,
      creadoEn: equipo.creadoEn,
      actualizadoEn: equipo.actualizadoEn,
    };
  }
}

export class EquiposPaginadosRespuestaDto extends PaginaRespuestaDto {
  @ApiProperty({ type: [EquipoRespuestaDto] })
  datos: EquipoRespuestaDto[];

  static desde(
    resultado: ResultadoPaginado<Equipo>,
  ): EquiposPaginadosRespuestaDto {
    return {
      ...resultado,
      datos: resultado.datos.map((e) => EquipoRespuestaDto.desde(e)),
    };
  }
}

export class MantenimientoRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  equipoId: string;

  @ApiProperty({ enum: TIPOS_MANTENIMIENTO })
  tipo: TipoMantenimiento;

  @ApiProperty()
  fechaMantenimiento: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  fechaProximo: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  responsable: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  proveedor: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  documentoSoporte: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  resultado: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  observaciones: string | null;

  @ApiProperty()
  creadoEn: Date;

  static desde(mantenimiento: Mantenimiento): MantenimientoRespuestaDto {
    return { ...mantenimiento };
  }
}

export class MantenimientoRegistradoRespuestaDto {
  @ApiProperty({
    type: EquipoRespuestaDto,
    description: 'Con las fechas de mantenimiento ya actualizadas',
  })
  equipo: EquipoRespuestaDto;

  @ApiProperty({ type: MantenimientoRespuestaDto })
  mantenimiento: MantenimientoRespuestaDto;
}
