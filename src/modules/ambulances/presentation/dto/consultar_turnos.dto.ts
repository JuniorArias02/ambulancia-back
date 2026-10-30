import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginacionDto } from '../../../../common/dto/paginacion.dto.js';
import {
  ESTADOS_TURNO,
  type EstadoTurno,
} from '../../domain/entities/turno.entity.js';

export class ConsultarTurnosDto extends PaginacionDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  ambulanciaId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Turnos de este tripulante',
  })
  @IsOptional()
  @IsUUID()
  usuarioId?: string;

  @ApiPropertyOptional({ enum: ESTADOS_TURNO })
  @IsOptional()
  @IsIn(ESTADOS_TURNO)
  estado?: EstadoTurno;
}
