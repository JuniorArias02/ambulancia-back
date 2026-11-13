import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class CambiarActivoDto {
  @ApiProperty({ description: 'true activa; false desactiva (nada se borra)' })
  @IsBoolean()
  activo: boolean;
}
