import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import {
  NOMBRES_ROLES,
  type NombreRol,
} from '../../../../common/constants/roles.js';

export class AsignarRolUsuarioDto {
  @ApiProperty({
    description: 'Nuevo rol; reemplaza el rol actual',
    enum: NOMBRES_ROLES,
    example: 'paramedico',
  })
  @IsIn(NOMBRES_ROLES)
  rol: NombreRol;
}
