import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ConsultarAccesoCiudadanoDto {
  @ApiProperty({
    example: '1.090.123.456',
    minLength: 4,
    maxLength: 40,
    description:
      'Cédula u otro documento; puntos, guiones y espacios se ignoran',
  })
  @IsString()
  @MinLength(4)
  @MaxLength(40)
  @Matches(/^[0-9A-Za-z.\s-]+$/, {
    message:
      'El número de documento solo admite letras, números, puntos y guiones',
  })
  numeroDocumento: string;
}
