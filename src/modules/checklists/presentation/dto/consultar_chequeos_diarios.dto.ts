import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID, Matches } from 'class-validator';
import { PaginacionDto } from '../../../../common/dto/paginacion.dto.js';
import {
  ESTADOS_CHEQUEO,
  type EstadoChequeo,
} from '../../domain/entities/chequeo_diario.entity.js';

const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MENSAJE_FECHA = 'Use el formato AAAA-MM-DD';

/** Filtros del historial del conductor (sin conductor ni ambulancia: salen del token). */
export class HistorialChequeosDto extends PaginacionDto {
  @ApiPropertyOptional({ enum: ESTADOS_CHEQUEO })
  @IsOptional()
  @IsIn(ESTADOS_CHEQUEO)
  estado?: EstadoChequeo;

  @ApiPropertyOptional({ example: '2026-11-01', description: 'AAAA-MM-DD' })
  @IsOptional()
  @Matches(PATRON_FECHA, { message: MENSAJE_FECHA })
  desde?: string;

  @ApiPropertyOptional({ example: '2026-11-30', description: 'AAAA-MM-DD' })
  @IsOptional()
  @Matches(PATRON_FECHA, { message: MENSAJE_FECHA })
  hasta?: string;
}

/** Filtros de la central. */
export class ConsultarChequeosDiariosDto extends HistorialChequeosDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  conductorId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  ambulanciaId?: string;
}
