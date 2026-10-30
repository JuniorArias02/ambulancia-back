import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';

export class GeocodificarCoordenadasDto {
  @ApiProperty({ minimum: -90, maximum: 90, example: 4.685519 })
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  latitud: number;

  @ApiProperty({ minimum: -180, maximum: 180, example: -74.052851 })
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  longitud: number;
}
