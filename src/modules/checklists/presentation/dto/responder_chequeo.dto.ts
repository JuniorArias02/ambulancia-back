import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { LONGITUD_MAXIMA_OBSERVACION } from '../../domain/entities/chequeo_diario.entity.js';

export class RespuestaDto {
  @ApiProperty({ format: 'uuid', description: 'Pregunta de la lista' })
  @IsUUID()
  itemId: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Opción elegida (Bien, Regular…)',
  })
  @IsUUID()
  estadoId: string;

  @ApiProperty()
  @IsBoolean()
  tieneObservacion: boolean;

  @ApiPropertyOptional({
    maxLength: 1000,
    description:
      'Obligatoria si tieneObservacion es true; se ignora si es false',
  })
  @IsOptional()
  @IsString()
  @MaxLength(LONGITUD_MAXIMA_OBSERVACION)
  observacion?: string;
}

/** Las reglas que cruzan campos (observación, misma lista) son del dominio. */
export class ResponderChequeoDto {
  @ApiProperty({ type: [RespuestaDto], minItems: 1, maxItems: 200 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => RespuestaDto)
  respuestas: RespuestaDto[];
}
