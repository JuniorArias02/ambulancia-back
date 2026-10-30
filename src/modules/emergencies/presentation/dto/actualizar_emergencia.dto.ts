import { ApiPropertyOptional } from '@nestjs/swagger';
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
  ValidateIf,
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

/** Valida el campo solo si viene con valor; `null` borra el dato. */
const SiTieneValor = () =>
  ValidateIf((_objeto, valor) => valor !== undefined && valor !== null);

/** Envíe solo lo que cambia. El estado no se cambia aquí. */
export class ActualizarEmergenciaDto {
  @ApiPropertyOptional({ enum: FUENTES_EMERGENCIA })
  @IsOptional()
  @IsIn(FUENTES_EMERGENCIA)
  fuente?: FuenteEmergencia;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 150 })
  @SiTieneValor()
  @IsString()
  @MaxLength(150)
  informanteNombre?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 30 })
  @SiTieneValor()
  @Matches(PATRON_TELEFONO_INFORMANTE, {
    message: 'El teléfono del informante no tiene un formato válido',
  })
  informanteTelefono?: string | null;

  @ApiPropertyOptional({
    minLength: LONGITUD_DESCRIPCION.minima,
    maxLength: LONGITUD_DESCRIPCION.maxima,
  })
  @IsOptional()
  @IsString()
  @MinLength(LONGITUD_DESCRIPCION.minima)
  @MaxLength(LONGITUD_DESCRIPCION.maxima)
  descripcion?: string;

  @ApiPropertyOptional({ enum: TIPOS_INCIDENTE, nullable: true })
  @SiTieneValor()
  @IsIn(TIPOS_INCIDENTE)
  tipoIncidente?: TipoIncidente | null;

  @ApiPropertyOptional({ enum: PRIORIDADES_EMERGENCIA, nullable: true })
  @SiTieneValor()
  @IsIn(PRIORIDADES_EMERGENCIA)
  prioridad?: PrioridadEmergencia | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 255 })
  @SiTieneValor()
  @IsString()
  @MaxLength(255)
  direccion?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 255 })
  @SiTieneValor()
  @IsString()
  @MaxLength(255)
  referenciaLugar?: string | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description:
      'Se envía junto con la longitud (las dos con valor o las dos en null)',
  })
  @SiTieneValor()
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  latitud?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @SiTieneValor()
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  longitud?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @SiTieneValor()
  @IsInt()
  @Min(0)
  @Max(MAXIMO_VICTIMAS)
  numeroVictimas?: number | null;
}
