import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import {
  ESTADOS_MANUALES,
  type EstadoManual,
} from '../../domain/entities/ambulancia.entity.js';

export class CambiarEstadoAmbulanciaDto {
  @ApiProperty({
    enum: ESTADOS_MANUALES,
    description:
      'en_servicio no se puede poner a mano: lo asignan los servicios',
  })
  @IsIn(ESTADOS_MANUALES)
  estado: EstadoManual;

  @ApiProperty({
    description: 'Justificación; queda en el historial de estados',
    minLength: 5,
    maxLength: 255,
  })
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  motivo: string;
}
