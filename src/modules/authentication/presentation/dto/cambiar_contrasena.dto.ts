import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { POLITICA_CONTRASENA } from '../../../users/presentation/dto/validaciones_usuario.js';

export class CambiarContrasenaDto {
  @ApiProperty({ maxLength: POLITICA_CONTRASENA.longitudMaxima })
  @IsString()
  @IsNotEmpty()
  @MaxLength(POLITICA_CONTRASENA.longitudMaxima)
  contrasenaActual: string;

  @ApiProperty({
    description: 'Mínimo 10 caracteres, con al menos una letra y un número',
    minLength: POLITICA_CONTRASENA.longitudMinima,
    maxLength: POLITICA_CONTRASENA.longitudMaxima,
  })
  @IsString()
  @MinLength(POLITICA_CONTRASENA.longitudMinima)
  @MaxLength(POLITICA_CONTRASENA.longitudMaxima)
  @Matches(POLITICA_CONTRASENA.patron, { message: POLITICA_CONTRASENA.mensaje })
  contrasenaNueva: string;
}
