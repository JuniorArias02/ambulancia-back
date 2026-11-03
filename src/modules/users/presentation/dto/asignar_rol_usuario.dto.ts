import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import {
  ROLES_INTERNOS,
  type NombreRol,
} from '../../../../common/constants/roles.js';

export class AsignarRolUsuarioDto {
  @ApiProperty({
    description: 'Nuevo rol; reemplaza el rol actual',
    enum: ROLES_INTERNOS,
    example: 'paramedico',
  })
  @IsIn(ROLES_INTERNOS)
  rol: NombreRol;
}
