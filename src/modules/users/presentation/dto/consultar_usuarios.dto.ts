import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  NOMBRES_ROLES,
  type NombreRol,
} from '../../../../common/constants/roles.js';
import { PaginacionDto } from '../../../../common/dto/paginacion.dto.js';
import {
  ESTADOS_USUARIO,
  type EstadoUsuario,
} from '../../domain/entities/usuario.entity.js';

export class ConsultarUsuariosDto extends PaginacionDto {
  @ApiPropertyOptional({ description: 'Busca en nombres, apellidos o correo' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  busqueda?: string;

  @ApiPropertyOptional({ enum: ESTADOS_USUARIO })
  @IsOptional()
  @IsIn(ESTADOS_USUARIO)
  estado?: EstadoUsuario;

  @ApiPropertyOptional({ enum: NOMBRES_ROLES })
  @IsOptional()
  @IsIn(NOMBRES_ROLES)
  rol?: NombreRol;
}
