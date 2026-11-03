import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class IniciarSesionCiudadanoDto {
  @ApiProperty({
    example: '1090123456',
    maxLength: 40,
    description:
      'Cédula u otro documento; puntos, guiones y espacios se ignoran',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  numeroDocumento: string;

  @ApiProperty({ maxLength: 128 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  contrasena: string;
}
