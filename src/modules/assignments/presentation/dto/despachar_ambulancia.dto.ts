import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class DespacharAmbulanciaDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  emergenciaId: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Debe estar disponible y con turno activo',
  })
  @IsUUID()
  ambulanciaId: string;
}
