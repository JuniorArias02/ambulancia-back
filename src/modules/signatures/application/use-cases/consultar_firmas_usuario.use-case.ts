import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import { UsuariosRepositorio } from '../../../users/domain/repositories/usuarios.repository.js';
import type { FirmaUsuario } from '../../domain/entities/firma_usuario.entity.js';
import { FirmasUsuariosRepositorio } from '../../domain/repositories/firmas_usuarios.repository.js';

/** Historial de firmas de un usuario, de la más reciente a la más antigua (administrador). */
@Injectable()
export class ConsultarFirmasUsuario {
  constructor(
    private readonly firmasRepositorio: FirmasUsuariosRepositorio,
    private readonly usuariosRepositorio: UsuariosRepositorio,
  ) {}

  async ejecutar(usuarioId: string): Promise<FirmaUsuario[]> {
    if (!(await this.usuariosRepositorio.buscarPorId(usuarioId))) {
      throw new RecursoNoEncontradoError('Usuario');
    }
    return this.firmasRepositorio.listarDeUsuario(usuarioId);
  }
}
