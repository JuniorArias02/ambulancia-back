import { Injectable } from '@nestjs/common';
import {
  ConflictoNegocioError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import { UsuariosRepositorio } from '../../../users/domain/repositories/usuarios.repository.js';
import {
  type NuevoIntegrante,
  Turno,
} from '../../domain/entities/turno.entity.js';
import { TurnosRepositorio } from '../../domain/repositories/turnos.repository.js';

/** Reglas sobre las personas de un turno que dependen de otros datos (usuarios y otros turnos). */
@Injectable()
export class ValidadorTripulacion {
  constructor(
    private readonly usuariosRepositorio: UsuariosRepositorio,
    private readonly turnosRepositorio: TurnosRepositorio,
  ) {}

  /** `turnoActualId` permite reemplazar integrantes sin chocar con el propio turno. */
  async validar(
    integrantes: NuevoIntegrante[],
    turnoActualId?: string,
  ): Promise<void> {
    for (const integrante of integrantes) {
      const usuario = await this.usuariosRepositorio.buscarPorId(
        integrante.usuarioId,
      );
      if (!usuario) {
        throw new ReglaNegocioError(
          `El usuario ${integrante.usuarioId} no existe`,
        );
      }
      const nombre = `${usuario.nombres} ${usuario.apellidos}`;
      if (!usuario.estaActivo()) {
        throw new ReglaNegocioError(`${nombre} no está activo`);
      }
      if (!Turno.puedeCumplir(usuario.rol, integrante.funcion)) {
        throw new ReglaNegocioError(
          `${nombre} tiene rol ${usuario.rol} y no puede ir como ${integrante.funcion}`,
        );
      }
      const otroTurno = await this.turnosRepositorio.buscarActivoDeUsuario(
        usuario.id,
      );
      if (otroTurno && otroTurno.id !== turnoActualId) {
        throw new ConflictoNegocioError(
          `${nombre} ya está en el turno activo de ${otroTurno.ambulanciaCodigo ?? 'otra ambulancia'}`,
        );
      }
    }
  }
}
