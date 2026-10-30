import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, Matches } from 'class-validator';
import {
  PATRON_CODIGO_AMBULANCIA,
  PATRON_PLACA,
} from './validaciones_ambulancia.js';

/** El estado operativo no se cambia aquí: tiene su propio endpoint. */
export class ActualizarAmbulanciaDto {
  @ApiPropertyOptional({ example: 'AMB-01' })
  @IsOptional()
  @Matches(PATRON_CODIGO_AMBULANCIA, {
    message: 'El código solo admite letras, números y guiones (2 a 30)',
  })
  codigo?: string;

  @ApiPropertyOptional({ example: 'ABC123' })
  @IsOptional()
  @Matches(PATRON_PLACA, { message: 'La placa debe tener el formato ABC123' })
  placa?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  tipoAmbulanciaId?: string;
}
