import { Injectable } from '@nestjs/common';
import {
  AccesoDenegadoError,
  NoAutenticadoError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import type { Turno } from '../../../ambulances/domain/entities/turno.entity.js';
import { TurnosRepositorio } from '../../../ambulances/domain/repositories/turnos.repository.js';
import { UbicacionInventario } from '../../domain/entities/ubicacion_inventario.entity.js';
import { UbicacionesInventarioRepositorio } from '../../domain/repositories/ubicaciones_inventario.repository.js';

export interface ParamedicoEnAmbulancia {
  paramedicoId: string;
  turno: Turno;
  ambulanciaId: string;
  ubicacion: UbicacionInventario;
}

/**
 * El inventario que opera el paramédico es el de la ambulancia de su turno
 * activo. Nunca sale del identificador que envía el celular.
 */
@Injectable()
export class UbicacionDelParamedico {
  constructor(
    private readonly turnosRepositorio: TurnosRepositorio,
    private readonly ubicaciones: UbicacionesInventarioRepositorio,
  ) {}

  async obtener(
    usuarioId: string | null,
    ahora: Date = new Date(),
  ): Promise<ParamedicoEnAmbulancia> {
    if (!usuarioId) throw new NoAutenticadoError();
    const turno = await this.turnosRepositorio.buscarActivoDeUsuario(usuarioId);
    if (!turno) {
      throw new ReglaNegocioError(
        'Seleccione su ambulancia antes de gestionar el inventario',
      );
    }
    if (turno.funcionDe(usuarioId) !== 'paramedico') {
      throw new AccesoDenegadoError(
        'Solo el paramédico de la ambulancia gestiona su inventario',
      );
    }
    // La primera vez que se usa, la ambulancia queda habilitada en el inventario.
    const { ubicacion } = await this.ubicaciones.asegurarDeAmbulancia(
      UbicacionInventario.deAmbulancia(turno.ambulanciaId, ahora),
    );
    ubicacion.exigirActiva();
    return {
      paramedicoId: usuarioId,
      turno,
      ambulanciaId: turno.ambulanciaId,
      ubicacion,
    };
  }
}
