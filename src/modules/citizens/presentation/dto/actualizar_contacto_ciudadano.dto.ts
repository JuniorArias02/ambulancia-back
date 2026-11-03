import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, Matches, MaxLength } from 'class-validator';
import { PATRON_TELEFONO } from '../../../users/presentation/dto/validaciones_usuario.js';

/** Rol, identidad y estado de verificación no se editan por aquí. */
export class ActualizarContactoCiudadanoDto {
  @ApiPropertyOptional({ example: 'laura.gomez@correo.co', maxLength: 150 })
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  correo?: string;

  @ApiPropertyOptional({ example: '+57 300 123 4567', maxLength: 30 })
  @IsOptional()
  @Matches(PATRON_TELEFONO, { message: 'El teléfono no es válido' })
  @MaxLength(30)
  telefono?: string;
}
