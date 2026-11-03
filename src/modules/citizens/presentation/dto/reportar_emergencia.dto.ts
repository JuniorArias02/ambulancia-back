import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ORIGENES_UBICACION,
  type OrigenUbicacion,
  TIPOS_INCIDENTE,
  type TipoIncidente,
} from '../../../emergencies/domain/entities/emergencia.entity.js';

export const MAXIMO_VICTIMAS_REPORTE = 100;

/**
 * No hay campos de prioridad, estado, informante ni ambulancia: el informante
 * sale de la cuenta y lo demás lo decide la central.
 */
export class ReportarEmergenciaDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'Generado por la app antes del primer envío. Reintentar con el mismo id devuelve el mismo reporte (idempotencia)',
  })
  @IsUUID()
  id: string;

  @ApiProperty({ enum: TIPOS_INCIDENTE })
  @IsIn(TIPOS_INCIDENTE)
  tipoIncidente: TipoIncidente;

  @ApiProperty({
    example: 'Choque de moto contra carro, el motociclista no se levanta',
    minLength: 10,
    maxLength: 1000,
  })
  @IsString()
  @Length(10, 1000)
  descripcion: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAXIMO_VICTIMAS_REPORTE,
    description: 'Número aproximado de personas afectadas',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAXIMO_VICTIMAS_REPORTE)
  numeroVictimas?: number;

  @ApiProperty({ minimum: -90, maximum: 90, example: 7.893906 })
  @IsNumber({ maxDecimalPlaces: 7, allowNaN: false, allowInfinity: false })
  @Min(-90)
  @Max(90)
  latitud: number;

  @ApiProperty({ minimum: -180, maximum: 180, example: -72.507782 })
  @IsNumber({ maxDecimalPlaces: 7, allowNaN: false, allowInfinity: false })
  @Min(-180)
  @Max(180)
  longitud: number;

  @ApiProperty({
    enum: ORIGENES_UBICACION,
    description: 'gps: del celular · manual: punto marcado en el mapa',
  })
  @IsIn(ORIGENES_UBICACION)
  origenUbicacion: OrigenUbicacion;

  @ApiPropertyOptional({
    example: 'Frente a la panadería, al lado del semáforo',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  referenciaLugar?: string;
}
