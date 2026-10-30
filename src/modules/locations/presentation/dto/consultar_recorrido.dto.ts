import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export const MAXIMO_PUNTOS_RECORRIDO = 2000;

export class ConsultarRecorridoDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Esta o asignacionId es obligatoria',
  })
  @IsOptional()
  @IsUUID()
  ambulanciaId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  asignacionId?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  desde?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  hasta?: Date;

  @ApiPropertyOptional({
    default: 500,
    minimum: 1,
    maximum: MAXIMO_PUNTOS_RECORRIDO,
    description: 'Se devuelven los últimos N puntos, en orden cronológico',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAXIMO_PUNTOS_RECORRIDO)
  limite: number = 500;
}
