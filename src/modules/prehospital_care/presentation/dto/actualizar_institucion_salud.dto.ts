import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  NIVELES_COMPLEJIDAD,
  type NivelComplejidad,
} from '../../domain/entities/institucion_salud.entity.js';
import { PATRON_TELEFONO_INSTITUCION } from './crear_institucion_salud.dto.js';

/** Valida el campo solo si viene con valor; `null` borra el dato. */
const SiTieneValor = () =>
  ValidateIf((_objeto, valor) => valor !== undefined && valor !== null);

export class ActualizarInstitucionSaludDto {
  @ApiPropertyOptional({ maxLength: 180 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  nombre?: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 50 })
  @SiTieneValor()
  @IsString()
  @MaxLength(50)
  codigoHabilitacion?: string | null;

  @ApiPropertyOptional({ enum: NIVELES_COMPLEJIDAD, nullable: true })
  @SiTieneValor()
  @IsIn(NIVELES_COMPLEJIDAD)
  nivelComplejidad?: NivelComplejidad | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @SiTieneValor()
  @Matches(PATRON_TELEFONO_INSTITUCION, {
    message: 'El teléfono no tiene un formato válido',
  })
  telefono?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 255 })
  @SiTieneValor()
  @IsString()
  @MaxLength(255)
  direccion?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
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
}

export class CambiarEstadoInstitucionDto {
  @ApiProperty({ type: Boolean, example: false })
  @IsBoolean()
  activa: boolean;
}
