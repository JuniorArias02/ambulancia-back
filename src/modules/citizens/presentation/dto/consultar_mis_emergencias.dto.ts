import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional } from 'class-validator';
import { PaginacionDto } from '../../../../common/dto/paginacion.dto.js';
import {
  ESTADOS_EMERGENCIA,
  type EstadoEmergencia,
} from '../../../emergencies/domain/entities/emergencia.entity.js';

export class ConsultarMisEmergenciasDto extends PaginacionDto {
  @ApiPropertyOptional({ enum: ESTADOS_EMERGENCIA })
  @IsOptional()
  @IsIn(ESTADOS_EMERGENCIA)
  estado?: EstadoEmergencia;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Reportadas desde esta fecha (ISO 8601)',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  desde?: Date;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Reportadas hasta esta fecha (ISO 8601)',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  hasta?: Date;
}
