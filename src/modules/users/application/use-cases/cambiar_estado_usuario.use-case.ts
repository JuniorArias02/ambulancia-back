import { Injectable } from '@nestjs/common';
import {
  RecursoNoEncontradoError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type {
  EstadoUsuario,
  Usuario,
} from '../../domain/entities/usuario.entity.js';
import { UsuariosRepositorio } from '../../domain/repositories/usuarios.repository.js';

export interface CambiarEstadoUsuarioEntrada {
  usuarioId: string;
  estado: EstadoUsuario;
  motivo: string;
}

/**
 * Un usuario inactivo o bloqueado pierde el acceso de inmediato: la
 * validación de sesión comprueba el estado en cada solicitud.
 */
@Injectable()
export class CambiarEstadoUsuario {
  constructor(
    private readonly usuariosRepositorio: UsuariosRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    datos: CambiarEstadoUsuarioEntrada,
    contexto: ContextoSolicitud,
  ): Promise<Usuario> {
    if (datos.usuarioId === contexto.usuarioId) {
      throw new ReglaNegocioError(
        'No puede cambiar el estado de su propio usuario',
      );
    }

    const usuario = await this.usuariosRepositorio.buscarPorId(datos.usuarioId);
    if (!usuario) throw new RecursoNoEncontradoError('Usuario');

    const estadoAnterior = usuario.estado;
    usuario.cambiarEstado(datos.estado);
    const actualizado = await this.usuariosRepositorio.actualizar(usuario);

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'usuarios',
      entidadId: usuario.id,
      accion: 'cambiar_estado',
      detalle: {
        estadoAnterior,
        estadoNuevo: datos.estado,
        motivo: datos.motivo,
      },
      direccionIp: contexto.direccionIp,
    });

    return actualizado;
  }
}
