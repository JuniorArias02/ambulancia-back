import { Injectable } from '@nestjs/common';
import { ConflictoNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import { Usuario } from '../../domain/entities/usuario.entity.js';
import { UsuariosRepositorio } from '../../domain/repositories/usuarios.repository.js';
import { HashContrasena } from '../../domain/services/hash_contrasena.service.js';

export interface CrearUsuarioEntrada {
  nombres: string;
  apellidos: string;
  correo: string;
  telefono?: string | null;
  contrasena: string;
  rol: string;
}

@Injectable()
export class CrearUsuario {
  constructor(
    private readonly usuariosRepositorio: UsuariosRepositorio,
    private readonly hashContrasena: HashContrasena,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    datos: CrearUsuarioEntrada,
    contexto: ContextoSolicitud,
  ): Promise<Usuario> {
    const correo = Usuario.normalizarCorreo(datos.correo);
    if (await this.usuariosRepositorio.existeCorreo(correo)) {
      throw new ConflictoNegocioError('Ya existe un usuario con ese correo');
    }

    const contrasenaHash = await this.hashContrasena.generar(datos.contrasena);
    const usuario = await this.usuariosRepositorio.crear(
      Usuario.crear({ ...datos, correo, contrasenaHash }),
    );

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'usuarios',
      entidadId: usuario.id,
      accion: 'crear',
      detalle: { rol: usuario.rol },
      direccionIp: contexto.direccionIp,
    });

    return usuario;
  }
}
