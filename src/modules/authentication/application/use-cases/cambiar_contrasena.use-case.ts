import { Injectable } from '@nestjs/common';
import {
  RecursoNoEncontradoError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import { UsuariosRepositorio } from '../../../users/domain/repositories/usuarios.repository.js';
import { HashContrasena } from '../../../users/domain/services/hash_contrasena.service.js';
import { SesionesRepositorio } from '../../domain/repositories/sesiones.repository.js';

export interface CambiarContrasenaEntrada {
  usuarioId: string;
  contrasenaActual: string;
  contrasenaNueva: string;
}

/** Al cambiar la contraseña se revocan todas las sesiones del usuario. */
@Injectable()
export class CambiarContrasena {
  constructor(
    private readonly usuariosRepositorio: UsuariosRepositorio,
    private readonly sesionesRepositorio: SesionesRepositorio,
    private readonly hashContrasena: HashContrasena,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    datos: CambiarContrasenaEntrada,
    contexto: ContextoSolicitud,
  ): Promise<void> {
    const usuario = await this.usuariosRepositorio.buscarPorId(datos.usuarioId);
    if (!usuario) throw new RecursoNoEncontradoError('Usuario');

    const actualValida = await this.hashContrasena.verificar(
      usuario.contrasenaHash,
      datos.contrasenaActual,
    );
    if (!actualValida) {
      throw new ReglaNegocioError('La contraseña actual no es correcta');
    }
    if (datos.contrasenaActual === datos.contrasenaNueva) {
      throw new ReglaNegocioError(
        'La nueva contraseña debe ser diferente de la actual',
      );
    }

    usuario.cambiarContrasena(
      await this.hashContrasena.generar(datos.contrasenaNueva),
    );
    await this.usuariosRepositorio.actualizar(usuario);
    await this.sesionesRepositorio.revocarTodasDelUsuario(
      usuario.id,
      new Date(),
    );

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'usuarios',
      entidadId: usuario.id,
      accion: 'cambiar_contrasena',
      direccionIp: contexto.direccionIp,
    });
  }
}
