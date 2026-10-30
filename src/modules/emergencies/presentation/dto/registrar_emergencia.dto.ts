import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  FUENTES_EMERGENCIA,
  type FuenteEmergencia,
  PRIORIDADES_EMERGENCIA,
  type PrioridadEmergencia,
  TIPOS_INCIDENTE,
  type TipoIncidente,
} from '../../domain/entities/emergencia.entity.js';
import {
  LONGITUD_DESCRIPCION,
  MAXIMO_VICTIMAS,
  PATRON_TELEFONO_INFORMANTE,
} from './validaciones_emergencia.js';

export class RegistrarEmergenciaDto {
  @ApiProperty({ enum: FUENTES_EMERGENCIA, example: 'linea_123' })
  @IsIn(FUENTES_EMERGENCIA)
  fuente: FuenteEmergencia;

  @ApiPropertyOptional({ maxLength: 150, example: 'Carlos Ruiz' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  informanteNombre?: string;

  @ApiPropertyOptional({ maxLength: 30, example: '+57 300 123 4567' })
  @IsOptional()
  @Matches(PATRON_TELEFONO_INFORMANTE, {
    message: 'El teléfono del informante no tiene un formato válido',
  })
  informanteTelefono?: string;

  @ApiProperty({
    minLength: LONGITUD_DESCRIPCION.minima,
    maxLength: LONGITUD_DESCRIPCION.maxima,
    example: 'Choque entre moto y carro, motociclista en el piso consciente',
  })
  @IsString()
  @MinLength(LONGITUD_DESCRIPCION.minima)
  @MaxLength(LONGITUD_DESCRIPCION.maxima)
  descripcion: string;

  @ApiPropertyOptional({ enum: TIPOS_INCIDENTE, example: 'accidente_transito' })
  @IsOptional()
  @IsIn(TIPOS_INCIDENTE)
  tipoIncidente?: TipoIncidente;

  @ApiPropertyOptional({ enum: PRIORIDADES_EMERGENCIA, example: 'amarilla' })
  @IsOptional()
  @IsIn(PRIORIDADES_EMERGENCIA)
  prioridad?: PrioridadEmergencia;

  @ApiPropertyOptional({
    maxLength: 255,
    description: 'Obligatoria si no se envían coordenadas',
    example: 'Calle 72 con Carrera 15',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  direccion?: string;

  @ApiPropertyOptional({
    maxLength: 255,
    example: 'Frente al centro comercial',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  referenciaLugar?: string;

  @ApiPropertyOptional({
    minimum: -90,
    maximum: 90,
    description: 'Se envía junto con la longitud',
    example: 4.6582,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  latitud?: number;

  @ApiPropertyOptional({ minimum: -180, maximum: 180, example: -74.0571 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  longitud?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: MAXIMO_VICTIMAS, example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAXIMO_VICTIMAS)
  numeroVictimas?: number;
}
