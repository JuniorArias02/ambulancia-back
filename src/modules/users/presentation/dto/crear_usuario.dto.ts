import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  ROLES_INTERNOS,
  type NombreRol,
} from '../../../../common/constants/roles.js';
import {
  PATRON_TELEFONO,
  POLITICA_CONTRASENA,
} from './validaciones_usuario.js';

export class CrearUsuarioDto {
  @ApiProperty({ example: 'Laura Marcela', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombres: string;

  @ApiProperty({ example: 'Gómez Pérez', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  apellidos: string;

  @ApiProperty({
    description: 'Correo único de acceso; se almacena en minúsculas',
    example: 'laura.gomez@ambulanciasgalenos.co',
    maxLength: 150,
  })
  @IsEmail()
  @MaxLength(150)
  correo: string;

  @ApiPropertyOptional({ example: '+57 300 123 4567', maxLength: 30 })
  @IsOptional()
  @Matches(PATRON_TELEFONO, {
    message: 'El teléfono no tiene un formato válido',
  })
  @MaxLength(30)
  telefono?: string;

  @ApiProperty({
    description:
      'Contraseña inicial: mínimo 10 caracteres, con al menos una letra y un número',
    minLength: POLITICA_CONTRASENA.longitudMinima,
    maxLength: POLITICA_CONTRASENA.longitudMaxima,
  })
  @IsString()
  @MinLength(POLITICA_CONTRASENA.longitudMinima)
  @MaxLength(POLITICA_CONTRASENA.longitudMaxima)
  @Matches(POLITICA_CONTRASENA.patron, { message: POLITICA_CONTRASENA.mensaje })
  contrasena: string;

  @ApiProperty({
    description: 'Rol que se asigna al usuario',
    enum: ROLES_INTERNOS,
    example: 'despachador',
  })
  @IsIn(ROLES_INTERNOS)
  rol: NombreRol;
}
