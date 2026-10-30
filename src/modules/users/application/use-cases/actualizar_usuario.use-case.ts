import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type {
  DatosPersonalesUsuario,
  Usuario,
} from '../../domain/entities/usuario.entity.js';
import { UsuariosRepositorio } from '../../domain/repositories/usuarios.repository.js';

@Injectable()
export class ActualizarUsuario {
  constructor(
    private readonly usuariosRepositorio: UsuariosRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    usuarioId: string,
    datos: DatosPersonalesUsuario,
    contexto: ContextoSolicitud,
  ): Promise<Usuario> {
    const usuario = await this.usuariosRepositorio.buscarPorId(usuarioId);
    if (!usuario) throw new RecursoNoEncontradoError('Usuario');

    usuario.actualizarDatosPersonales(datos);
    const actualizado = await this.usuariosRepositorio.actualizar(usuario);

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'usuarios',
      entidadId: usuario.id,
      accion: 'actualizar',
      detalle: {
        campos: Object.entries(datos)
          .filter(([, valor]) => valor !== undefined)
          .map(([campo]) => campo),
      },
      direccionIp: contexto.direccionIp,
    });

    return actualizado;
  }
}
