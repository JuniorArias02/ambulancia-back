import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class MarcarDuplicadaDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Emergencia que sí se va a atender',
  })
  @IsUUID()
  emergenciaPrincipalId: string;
}
