import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NOMBRES_ROLES,
  type NombreRol,
} from '../../../../common/constants/roles.js';
import type { ResultadoPaginado } from '../../../../common/types/resultado_paginado.js';
import {
  ESTADOS_USUARIO,
  type EstadoUsuario,
  type Usuario,
} from '../../domain/entities/usuario.entity.js';

export class UsuarioRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  nombres: string;

  @ApiProperty()
  apellidos: string;

  @ApiProperty()
  correo: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  telefono: string | null;

  @ApiProperty({ enum: ESTADOS_USUARIO })
  estado: EstadoUsuario;

  @ApiProperty({ enum: NOMBRES_ROLES })
  rol: NombreRol;

  @ApiPropertyOptional({ type: Date, nullable: true })
  ultimoAcceso: Date | null;

  @ApiProperty()
  creadoEn: Date;

  static desde(usuario: Usuario): UsuarioRespuestaDto {
    return {
      id: usuario.id,
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
      correo: usuario.correo,
      telefono: usuario.telefono,
      estado: usuario.estado,
      rol: usuario.rol,
      ultimoAcceso: usuario.ultimoAcceso,
      creadoEn: usuario.creadoEn,
    };
  }
}

export class UsuariosPaginadosRespuestaDto {
  @ApiProperty({ type: [UsuarioRespuestaDto] })
  datos: UsuarioRespuestaDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  pagina: number;

  @ApiProperty()
  limite: number;

  static desde(
    resultado: ResultadoPaginado<Usuario>,
  ): UsuariosPaginadosRespuestaDto {
    return {
      ...resultado,
      datos: resultado.datos.map((usuario) =>
        UsuarioRespuestaDto.desde(usuario),
      ),
    };
  }
}
