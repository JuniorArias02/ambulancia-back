import { Injectable } from '@nestjs/common';
import { Roles } from '../../../../common/constants/roles.js';
import {
  RecursoNoEncontradoError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type { Usuario } from '../../domain/entities/usuario.entity.js';
import { UsuariosRepositorio } from '../../domain/repositories/usuarios.repository.js';

@Injectable()
export class AsignarRolUsuario {
  constructor(
    private readonly usuariosRepositorio: UsuariosRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    usuarioId: string,
    rol: string,
    contexto: ContextoSolicitud,
  ): Promise<Usuario> {
    const usuario = await this.usuariosRepositorio.buscarPorId(usuarioId);
    if (!usuario) throw new RecursoNoEncontradoError('Usuario');

    // Evita que un administrador se quite a sí mismo el acceso administrativo.
    const esPropioUsuario = usuarioId === contexto.usuarioId;
    if (
      esPropioUsuario &&
      usuario.tieneRol(Roles.ADMINISTRADOR) &&
      rol !== Roles.ADMINISTRADOR
    ) {
      throw new ReglaNegocioError(
        'No puede retirarse a sí mismo el rol de administrador',
      );
    }

    const rolAnterior = usuario.rol;
    usuario.asignarRol(rol);
    const actualizado = await this.usuariosRepositorio.actualizar(usuario);

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'usuarios',
      entidadId: usuario.id,
      accion: 'asignar_rol',
      detalle: { rolAnterior, rolNuevo: actualizado.rol },
      direccionIp: contexto.direccionIp,
    });

    return actualizado;
  }
}
