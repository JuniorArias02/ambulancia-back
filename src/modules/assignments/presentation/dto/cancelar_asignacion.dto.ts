import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CancelarAsignacionDto {
  @ApiProperty({
    minLength: 5,
    maxLength: 255,
    example: 'Se despacha una ambulancia más cercana',
  })
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  motivo: string;
}
