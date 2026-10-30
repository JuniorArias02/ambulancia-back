import { Injectable } from '@nestjs/common';
import { Roles, type NombreRol } from '../../../../common/constants/roles.js';
import { AccesoDenegadoError } from '../../../../common/exceptions/errores_dominio.js';
import { TurnosRepositorio } from '../../../ambulances/domain/repositories/turnos.repository.js';
import type { Asignacion } from '../../domain/entities/asignacion.entity.js';

export interface Solicitante {
  usuarioId: string | null;
  rol: NombreRol;
}

const ROLES_CENTRAL: readonly NombreRol[] = [
  Roles.ADMINISTRADOR,
  Roles.DESPACHADOR,
];

/** Quién puede actuar sobre un servicio: la central o la tripulación de su turno. */
@Injectable()
export class PermisoServicio {
  constructor(private readonly turnosRepositorio: TurnosRepositorio) {}

  async exigirCentralOTripulacion(
    asignacion: Asignacion,
    solicitante: Solicitante,
  ): Promise<void> {
    if (ROLES_CENTRAL.includes(solicitante.rol)) return;
    if (!(await this.funcionEnElTurno(asignacion, solicitante))) {
      throw new AccesoDenegadoError(
        'Solo la tripulación asignada puede actualizar este servicio',
      );
    }
  }

  /** La llegada a la escena la confirma quien maneja, desde la ambulancia. */
  async exigirConductor(
    asignacion: Asignacion,
    solicitante: Solicitante,
  ): Promise<void> {
    if (
      (await this.funcionEnElTurno(asignacion, solicitante)) !== 'conductor'
    ) {
      throw new AccesoDenegadoError(
        'Solo el conductor de la ambulancia asignada puede confirmar la llegada',
      );
    }
  }

  private async funcionEnElTurno(
    asignacion: Asignacion,
    { usuarioId }: Solicitante,
  ): Promise<string | null> {
    if (!usuarioId || !asignacion.turnoId) return null;
    const turno = await this.turnosRepositorio.buscarPorId(asignacion.turnoId);
    return (
      turno?.integrantes.find((i) => i.usuarioId === usuarioId)?.funcion ?? null
    );
  }
}
