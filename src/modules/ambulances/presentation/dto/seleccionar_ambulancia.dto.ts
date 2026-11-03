import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class SeleccionarAmbulanciaDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  ambulanciaId: string;
}
