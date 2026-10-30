import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class ReportarUbicacionDto {
  @ApiProperty({ minimum: -90, maximum: 90, example: 4.6582 })
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  latitud: number;

  @ApiProperty({ minimum: -180, maximum: 180, example: -74.0571 })
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  longitud: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 400, description: 'km/h' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(400)
  velocidad?: number;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description:
      'Hora en que el celular tomó la posición (útil si estuvo sin señal)',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  registradaEn?: Date;
}
