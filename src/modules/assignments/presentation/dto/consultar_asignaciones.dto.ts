import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginacionDto } from '../../../../common/dto/paginacion.dto.js';
import {
  ESTADOS_ASIGNACION,
  type EstadoAsignacion,
} from '../../domain/entities/asignacion.entity.js';

export class ConsultarAsignacionesDto extends PaginacionDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  emergenciaId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  ambulanciaId?: string;

  @ApiPropertyOptional({ enum: ESTADOS_ASIGNACION })
  @IsOptional()
  @IsIn(ESTADOS_ASIGNACION)
  estado?: EstadoAsignacion;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Solo asignada, en_camino, en_escena y trasladando. Se ignora si envía estado',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  soloActivas?: boolean;
}
