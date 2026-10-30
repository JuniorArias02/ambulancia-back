import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  ESTADOS_AVANCE,
  type EstadoAvance,
} from '../../domain/entities/asignacion.entity.js';

export class AvanzarAsignacionDto {
  @ApiProperty({
    enum: ESTADOS_AVANCE,
    description:
      'asignada → en_camino → en_escena → atendiendo → trasladando → finalizada. ' +
      'Desde en_escena o atendiendo también se puede finalizar sin traslado (con observacion)',
  })
  @IsIn(ESTADOS_AVANCE)
  estado: EstadoAvance;

  @ApiPropertyOptional({
    minimum: -90,
    maximum: 90,
    description:
      'GPS del celular. Obligatorio para en_escena (lo confirma el conductor)',
    example: 7.90695,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  latitud?: number;

  @ApiPropertyOptional({ minimum: -180, maximum: 180, example: -72.49702 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  longitud?: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 10000,
    description: 'Precisión del GPS en metros',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(10000)
  precisionMetros?: number;

  @ApiPropertyOptional({
    minLength: 5,
    maxLength: 255,
    description:
      'Obligatoria al finalizar sin traslado y al confirmar la llegada fuera del radio',
    example: 'Paciente atendido en el sitio, no requiere traslado',
  })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  observacion?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Solo en en_escena: el conductor confirma que llegó aunque el GPS lo ubique fuera del radio (exige observacion)',
  })
  @IsOptional()
  @IsBoolean()
  confirmarFueraDeRadio?: boolean;
}
