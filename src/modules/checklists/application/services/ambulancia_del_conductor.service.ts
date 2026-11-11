import { Injectable } from '@nestjs/common';
import {
  AccesoDenegadoError,
  NoAutenticadoError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import { TurnosRepositorio } from '../../../ambulances/domain/repositories/turnos.repository.js';

export interface ConductorEnAmbulancia {
  conductorId: string;
  ambulanciaId: string;
}

/**
 * La ambulancia del chequeo sale del turno del conductor (la que eligió en la
 * app), nunca de lo que envía el cliente.
 */
@Injectable()
export class AmbulanciaDelConductor {
  constructor(private readonly turnosRepositorio: TurnosRepositorio) {}

  async obtener(usuarioId: string | null): Promise<ConductorEnAmbulancia> {
    if (!usuarioId) throw new NoAutenticadoError();
    const turno = await this.turnosRepositorio.buscarActivoDeUsuario(usuarioId);
    if (!turno) {
      throw new ReglaNegocioError(
        'Seleccione su ambulancia antes de diligenciar la lista de chequeo',
      );
    }
    if (turno.funcionDe(usuarioId) !== 'conductor') {
      throw new AccesoDenegadoError(
        'Solo el conductor de la ambulancia diligencia la lista de chequeo',
      );
    }
    return { conductorId: usuarioId, ambulanciaId: turno.ambulanciaId };
  }
}
