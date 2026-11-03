import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class DefinirDestinoAsignacionDto {
  @ApiProperty({ format: 'uuid', description: 'Institución de salud activa' })
  @IsUUID()
  institucionId: string;
}
