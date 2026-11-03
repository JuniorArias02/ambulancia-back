import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  TIPOS_DOCUMENTO_CIUDADANO,
  type TipoDocumentoCiudadano,
} from '../../domain/entities/ciudadano.entity.js';
import { PATRON_FECHA_CALENDARIO } from './registrar_ciudadano.dto.js';

/** Solo lo que pidió corregir el administrador; lo que no venga se conserva. */
export class ReenviarVerificacionDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombres?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  apellidos?: string;

  @ApiPropertyOptional({ enum: TIPOS_DOCUMENTO_CIUDADANO })
  @IsOptional()
  @IsIn(TIPOS_DOCUMENTO_CIUDADANO)
  tipoDocumento?: TipoDocumentoCiudadano;

  @ApiPropertyOptional({ maxLength: 40 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  numeroDocumento?: string;

  @ApiPropertyOptional({ example: '1990-05-17' })
  @IsOptional()
  @Matches(PATRON_FECHA_CALENDARIO, {
    message: 'La fecha de nacimiento debe tener el formato AAAA-MM-DD',
  })
  fechaNacimiento?: string;
}

/** Solo para Swagger. */
export class ReenviarVerificacionFormularioDto extends ReenviarVerificacionDto {
  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  documentoFrontal?: unknown;

  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  documentoPosterior?: unknown;
}
