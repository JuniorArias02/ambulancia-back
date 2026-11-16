import { Injectable } from '@nestjs/common';
import {
  NoAutenticadoError,
  RecursoNoEncontradoError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import { UsuariosRepositorio } from '../../../users/domain/repositories/usuarios.repository.js';
import { HashContrasena } from '../../../users/domain/services/hash_contrasena.service.js';
import { SesionesRepositorio } from '../../domain/repositories/sesiones.repository.js';

/**
 * El administrador asigna una contraseña nueva a otro usuario (olvido,
 * bloqueo, sospecha de acceso indebido). No necesita la actual. Se cierran
 * todas las sesiones del usuario para que nadie siga entrando con la anterior.
 */
@Injectable()
export class RestablecerContrasena {
  constructor(
    private readonly usuariosRepositorio: UsuariosRepositorio,
    private readonly sesionesRepositorio: SesionesRepositorio,
    private readonly hashContrasena: HashContrasena,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    usuarioId: string,
    contrasenaNueva: string,
    contexto: ContextoSolicitud,
  ): Promise<void> {
    if (!contexto.usuarioId) throw new NoAutenticadoError();
    // La propia se cambia con /autenticacion/contrasena, que exige la actual:
    // así una sesión robada de un administrador no puede quedarse con su cuenta.
    if (contexto.usuarioId === usuarioId) {
      throw new ReglaNegocioError(
        'Para cambiar su propia contraseña use "Cambiar contraseña" (exige la actual)',
      );
    }

    const usuario = await this.usuariosRepositorio.buscarPorId(usuarioId);
    if (!usuario) throw new RecursoNoEncontradoError('Usuario');

    usuario.cambiarContrasena(
      await this.hashContrasena.generar(contrasenaNueva),
    );
    await this.usuariosRepositorio.actualizar(usuario);
    await this.sesionesRepositorio.revocarTodasDelUsuario(
      usuario.id,
      new Date(),
    );

    // Nunca la contraseña ni su hash en la auditoría.
    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'usuarios',
      entidadId: usuario.id,
      accion: 'restablecer_contrasena',
      detalle: { rolUsuario: usuario.rol, sesionesCerradas: true },
      direccionIp: contexto.direccionIp,
    });
  }
}
