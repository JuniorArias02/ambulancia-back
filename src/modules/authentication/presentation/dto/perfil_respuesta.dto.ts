import { ApiProperty } from '@nestjs/swagger';
import {
  NOMBRES_ROLES,
  type NombreRol,
} from '../../../../common/constants/roles.js';
import type { Usuario } from '../../../users/domain/entities/usuario.entity.js';

export class PerfilRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  nombres: string;

  @ApiProperty()
  apellidos: string;

  @ApiProperty()
  correo: string;

  @ApiProperty({ enum: NOMBRES_ROLES, example: 'despachador' })
  rol: NombreRol;

  static desde(usuario: Usuario): PerfilRespuestaDto {
    return {
      id: usuario.id,
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
      correo: usuario.correo,
      rol: usuario.rol,
    };
  }
}
