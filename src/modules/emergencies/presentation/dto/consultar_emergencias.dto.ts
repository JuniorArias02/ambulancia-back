import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginacionDto } from '../../../../common/dto/paginacion.dto.js';
import {
  ESTADOS_EMERGENCIA,
  type EstadoEmergencia,
  PRIORIDADES_EMERGENCIA,
  type PrioridadEmergencia,
  TIPOS_INCIDENTE,
  type TipoIncidente,
} from '../../domain/entities/emergencia.entity.js';

export class ConsultarEmergenciasDto extends PaginacionDto {
  @ApiPropertyOptional({
    description: 'Busca en número, descripción, dirección e informante',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  busqueda?: string;

  @ApiPropertyOptional({ enum: ESTADOS_EMERGENCIA })
  @IsOptional()
  @IsIn(ESTADOS_EMERGENCIA)
  estado?: EstadoEmergencia;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Solo recibida, despachada y en_atencion. Se ignora si envía estado',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  soloActivas?: boolean;

  @ApiPropertyOptional({ enum: PRIORIDADES_EMERGENCIA })
  @IsOptional()
  @IsIn(PRIORIDADES_EMERGENCIA)
  prioridad?: PrioridadEmergencia;

  @ApiPropertyOptional({ enum: TIPOS_INCIDENTE })
  @IsOptional()
  @IsIn(TIPOS_INCIDENTE)
  tipoIncidente?: TipoIncidente;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Recibidas desde esta fecha (ISO 8601)',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  desde?: Date;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Recibidas hasta esta fecha (ISO 8601)',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  hasta?: Date;
}
