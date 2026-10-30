import { Injectable } from '@nestjs/common';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type { Usuario } from '../../domain/entities/usuario.entity.js';
import {
  type FiltrosUsuarios,
  UsuariosRepositorio,
} from '../../domain/repositories/usuarios.repository.js';

@Injectable()
export class ConsultarUsuarios {
  constructor(private readonly usuariosRepositorio: UsuariosRepositorio) {}

  ejecutar(
    filtros: FiltrosUsuarios,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<Usuario>> {
    return this.usuariosRepositorio.listar(filtros, paginacion);
  }
}
