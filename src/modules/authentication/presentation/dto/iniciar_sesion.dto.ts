import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class IniciarSesionDto {
  @ApiProperty({ example: 'admin@ambulanciasgalenos.co', maxLength: 150 })
  @IsEmail()
  @MaxLength(150)
  correo: string;

  @ApiProperty({ maxLength: 128 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  contrasena: string;
}
