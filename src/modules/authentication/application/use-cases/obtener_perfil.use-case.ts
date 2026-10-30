import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type { Usuario } from '../../../users/domain/entities/usuario.entity.js';
import { UsuariosRepositorio } from '../../../users/domain/repositories/usuarios.repository.js';

@Injectable()
export class ObtenerPerfil {
  constructor(private readonly usuariosRepositorio: UsuariosRepositorio) {}

  async ejecutar(usuarioId: string): Promise<Usuario> {
    const usuario = await this.usuariosRepositorio.buscarPorId(usuarioId);
    if (!usuario) throw new RecursoNoEncontradoError('Usuario');
    return usuario;
  }
}
