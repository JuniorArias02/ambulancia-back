import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Rol } from '../../domain/entities/rol.entity.js';

export class RolRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'despachador' })
  nombre: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  descripcion: string | null;

  static desde(rol: Rol): RolRespuestaDto {
    return { id: rol.id, nombre: rol.nombre, descripcion: rol.descripcion };
  }
}
