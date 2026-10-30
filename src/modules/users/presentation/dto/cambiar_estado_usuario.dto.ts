import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import {
  ESTADOS_USUARIO,
  type EstadoUsuario,
} from '../../domain/entities/usuario.entity.js';

export class CambiarEstadoUsuarioDto {
  @ApiProperty({ enum: ESTADOS_USUARIO })
  @IsIn(ESTADOS_USUARIO)
  estado: EstadoUsuario;

  @ApiProperty({
    description: 'Justificación del cambio, queda registrada en auditoría',
    minLength: 5,
    maxLength: 255,
  })
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  motivo: string;
}
