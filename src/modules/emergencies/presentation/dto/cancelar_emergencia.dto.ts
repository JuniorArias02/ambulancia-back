import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CancelarEmergenciaDto {
  @ApiProperty({
    description: 'Justificación; queda en la auditoría',
    minLength: 5,
    maxLength: 255,
    example: 'El informante confirma que ya no necesita ambulancia',
  })
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  motivo: string;
}
