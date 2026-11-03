import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  PATRON_TELEFONO,
  POLITICA_CONTRASENA,
} from '../../../users/presentation/dto/validaciones_usuario.js';
import {
  TIPOS_DOCUMENTO_CIUDADANO,
  type TipoDocumentoCiudadano,
} from '../../domain/entities/ciudadano.entity.js';

export const PATRON_FECHA_CALENDARIO = /^\d{4}-\d{2}-\d{2}$/;

/** Campos de texto del formulario multipart; las fotos van aparte. */
export class RegistrarCiudadanoDto {
  @ApiProperty({ example: 'Laura', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombres: string;

  @ApiProperty({ example: 'Gómez Rojas', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  apellidos: string;

  @ApiProperty({
    enum: TIPOS_DOCUMENTO_CIUDADANO,
    description: 'Solo documentos de adultos',
  })
  @IsIn(TIPOS_DOCUMENTO_CIUDADANO)
  tipoDocumento: TipoDocumentoCiudadano;

  @ApiProperty({
    example: '1090123456',
    maxLength: 40,
    description: 'Se guarda sin puntos, guiones ni espacios',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  numeroDocumento: string;

  @ApiProperty({
    example: '1990-05-17',
    description: 'AAAA-MM-DD; debe ser mayor de 18 años',
  })
  @Matches(PATRON_FECHA_CALENDARIO, {
    message: 'La fecha de nacimiento debe tener el formato AAAA-MM-DD',
  })
  fechaNacimiento: string;

  @ApiProperty({ example: '+57 300 123 4567', maxLength: 30 })
  @Matches(PATRON_TELEFONO, { message: 'El teléfono no es válido' })
  @MaxLength(30)
  telefono: string;

  @ApiProperty({ example: 'laura.gomez@correo.co', maxLength: 150 })
  @IsEmail()
  @MaxLength(150)
  correo: string;

  @ApiProperty({
    description: 'Mínimo 10 caracteres, con al menos una letra y un número',
    minLength: POLITICA_CONTRASENA.longitudMinima,
    maxLength: POLITICA_CONTRASENA.longitudMaxima,
  })
  @IsString()
  @MinLength(POLITICA_CONTRASENA.longitudMinima)
  @MaxLength(POLITICA_CONTRASENA.longitudMaxima)
  @Matches(POLITICA_CONTRASENA.patron, { message: POLITICA_CONTRASENA.mensaje })
  contrasena: string;
}

/** Solo para Swagger: el formulario completo con las dos fotos. */
export class RegistrarCiudadanoFormularioDto extends RegistrarCiudadanoDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Foto frontal del documento: JPG o PNG, de 5 KB a 5 MB',
  })
  documentoFrontal: unknown;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Foto posterior del documento: JPG o PNG, de 5 KB a 5 MB',
  })
  documentoPosterior: unknown;
}
