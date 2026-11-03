import { Injectable } from '@nestjs/common';
import { Roles, type NombreRol } from '../../../../common/constants/roles.js';
import {
  AccesoDenegadoError,
  RecursoNoEncontradoError,
} from '../../../../common/exceptions/errores_dominio.js';
import { TurnosRepositorio } from '../../../ambulances/domain/repositories/turnos.repository.js';
import type { Asignacion } from '../../../assignments/domain/entities/asignacion.entity.js';
import { AsignacionesRepositorio } from '../../../assignments/domain/repositories/asignaciones.repository.js';
import type { RutaAsignacion } from '../../domain/entities/ruta_asignacion.entity.js';
import { RutasAsignacionRepositorio } from '../../domain/repositories/rutas_asignacion.repository.js';

export interface RutaDeAsignacion {
  asignacion: Asignacion;
  ruta: RutaAsignacion;
}

export interface Solicitante {
  usuarioId: string | null;
  rol: NombreRol;
}

const ROLES_CENTRAL: readonly NombreRol[] = [
  Roles.ADMINISTRADOR,
  Roles.DESPACHADOR,
];

@Injectable()
export class ObtenerRutaAsignacion {
  constructor(
    private readonly rutasRepositorio: RutasAsignacionRepositorio,
    private readonly asignacionesRepositorio: AsignacionesRepositorio,
    private readonly turnosRepositorio: TurnosRepositorio,
  ) {}

  /** `solicitante` se omite cuando lo pide el propio sistema (por ejemplo, el tiempo real). */
  async ejecutar(
    asignacionId: string,
    solicitante?: Solicitante,
  ): Promise<RutaDeAsignacion> {
    const asignacion =
      await this.asignacionesRepositorio.buscarPorId(asignacionId);
    if (!asignacion) throw new RecursoNoEncontradoError('Asignación');
    if (solicitante) await this.exigirPermiso(asignacion, solicitante);

    const ruta = await this.rutasRepositorio.buscarVigente(asignacionId);
    // Una ruta de otro tramo o de un hospital anterior ya no se muestra.
    if (!ruta?.esVigentePara(asignacion)) {
      throw new RecursoNoEncontradoError('Ruta del servicio');
    }
    return { asignacion, ruta };
  }

  /** La tripulación solo ve la ruta de su propio servicio. */
  private async exigirPermiso(
    asignacion: Asignacion,
    { usuarioId, rol }: Solicitante,
  ): Promise<void> {
    if (ROLES_CENTRAL.includes(rol)) return;
    const turno = asignacion.turnoId
      ? await this.turnosRepositorio.buscarPorId(asignacion.turnoId)
      : null;
    if (!turno || !usuarioId || !turno.incluyeA(usuarioId)) {
      throw new AccesoDenegadoError(
        'Solo la tripulación asignada puede ver esta ruta',
      );
    }
  }
}
