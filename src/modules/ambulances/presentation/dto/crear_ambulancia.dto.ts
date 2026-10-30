import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, Matches } from 'class-validator';
import {
  PATRON_CODIGO_AMBULANCIA,
  PATRON_PLACA,
} from './validaciones_ambulancia.js';

export class CrearAmbulanciaDto {
  @ApiProperty({
    description: 'Código interno único; se guarda en mayúsculas',
    example: 'AMB-01',
  })
  @Matches(PATRON_CODIGO_AMBULANCIA, {
    message: 'El código solo admite letras, números y guiones (2 a 30)',
  })
  codigo: string;

  @ApiProperty({
    description: 'Placa única; se guarda sin espacios ni guiones',
    example: 'ABC123',
  })
  @Matches(PATRON_PLACA, { message: 'La placa debe tener el formato ABC123' })
  placa: string;

  @ApiProperty({ format: 'uuid', description: 'Id de GET /tipos-ambulancia' })
  @IsUUID()
  tipoAmbulanciaId: string;
}
