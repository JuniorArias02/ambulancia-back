import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { IntegrantesTurnoDto } from './integrante_turno.dto.js';

export class IniciarTurnoDto extends IntegrantesTurnoDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  ambulanciaId: string;
}
