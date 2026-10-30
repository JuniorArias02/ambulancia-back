import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  NIVELES_COMPLEJIDAD,
  type NivelComplejidad,
} from '../../domain/entities/institucion_salud.entity.js';

export const PATRON_TELEFONO_INSTITUCION = /^\+?[0-9\s-]{7,20}$/;

export class CrearInstitucionSaludDto {
  @ApiProperty({
    maxLength: 180,
    example: 'Hospital Universitario San Ignacio',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  nombre: string;

  @ApiPropertyOptional({
    maxLength: 50,
    description: 'Código de habilitación del REPS; único',
    example: '110010612301',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  codigoHabilitacion?: string;

  @ApiPropertyOptional({ enum: NIVELES_COMPLEJIDAD })
  @IsOptional()
  @IsIn(NIVELES_COMPLEJIDAD)
  nivelComplejidad?: NivelComplejidad;

  @ApiPropertyOptional({ maxLength: 30, example: '+57 601 594 6161' })
  @IsOptional()
  @Matches(PATRON_TELEFONO_INSTITUCION, {
    message: 'El teléfono no tiene un formato válido',
  })
  telefono?: string;

  @ApiPropertyOptional({ maxLength: 255, example: 'Carrera 7 # 40-62' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  direccion?: string;

  @ApiPropertyOptional({ minimum: -90, maximum: 90, example: 4.6283 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  latitud?: number;

  @ApiPropertyOptional({ minimum: -180, maximum: 180, example: -74.0644 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  longitud?: number;
}
