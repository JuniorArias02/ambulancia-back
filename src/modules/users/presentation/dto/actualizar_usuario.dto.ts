import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PATRON_TELEFONO } from './validaciones_usuario.js';

/**
 * Solo datos personales. Correo, estado, rol y contraseña tienen
 * operaciones propias porque sus reglas de negocio son distintas.
 */
export class ActualizarUsuarioDto {
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

  @ApiPropertyOptional({
    description: 'Envíe null para eliminar el teléfono',
    nullable: true,
    maxLength: 30,
  })
  @ValidateIf((_objeto, valor) => valor !== undefined && valor !== null)
  @Matches(PATRON_TELEFONO, {
    message: 'El teléfono no tiene un formato válido',
  })
  @MaxLength(30)
  telefono?: string | null;
}
