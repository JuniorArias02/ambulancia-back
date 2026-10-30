import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class GeocodificarDireccionDto {
  @ApiProperty({
    minLength: 3,
    maxLength: 200,
    example: 'Calle 72 # 15-20',
    description:
      'Se normaliza: "Cl. 72 #15-20" y "calle 72 no 15 20" son la misma dirección',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  direccion: string;

  @ApiPropertyOptional({
    maxLength: 80,
    example: 'Bogotá',
    description:
      'Muy recomendada: la misma dirección existe en muchas ciudades',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  ciudad?: string;
}
