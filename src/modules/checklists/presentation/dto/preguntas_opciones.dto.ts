import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { LONGITUDES_LISTA } from '../../domain/entities/lista_chequeo.entity.js';

/** Para agregar se reutilizan CrearPreguntaDto y CrearOpcionDto. */
export class ActualizarPreguntaDto {
  @ApiPropertyOptional({
    maxLength: 500,
    description: 'Si ya tiene respuestas no se cambia (409)',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(LONGITUDES_LISTA.pregunta)
  pregunta?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  obligatorio?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  permiteObservacion?: boolean;

  @ApiPropertyOptional({ description: 'false la desactiva (no se borra)' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ActualizarOpcionDto {
  @ApiPropertyOptional({ maxLength: 60 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(LONGITUDES_LISTA.nombreEstado)
  nombre?: string;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsInt()
  valor?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;

  @ApiPropertyOptional({ description: 'false la desactiva (no se borra)' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
