import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  DECISIONES_VERIFICACION,
  type DecisionVerificacion,
  LONGITUD_MAXIMA_MOTIVO,
} from '../../domain/entities/verificacion_identidad.entity.js';

export class DecidirVerificacionDto {
  @ApiProperty({
    enum: DECISIONES_VERIFICACION,
    description:
      'en_revision: tomarla · verificado: aprobar · rechazado: rechazar (final) · requiere_correccion: pedir fotos o datos nuevos',
  })
  @IsIn(DECISIONES_VERIFICACION)
  decision: DecisionVerificacion;

  @ApiPropertyOptional({
    maxLength: LONGITUD_MAXIMA_MOTIVO,
    example: 'La foto posterior está borrosa; tómela de nuevo con buena luz',
    description:
      'Obligatorio para rechazado y requiere_correccion. Lo verá el ciudadano: no incluya notas internas',
  })
  @IsOptional()
  @IsString()
  @MaxLength(LONGITUD_MAXIMA_MOTIVO)
  motivo?: string;

  @ApiPropertyOptional({
    maxLength: 2000,
    description: 'Notas internas; el ciudadano nunca las ve',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observaciones?: string;
}
