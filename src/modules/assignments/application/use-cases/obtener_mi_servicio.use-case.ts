import { Injectable } from '@nestjs/common';
import type { Turno } from '../../../ambulances/domain/entities/turno.entity.js';
import { TurnosRepositorio } from '../../../ambulances/domain/repositories/turnos.repository.js';
import type { Emergencia } from '../../../emergencies/domain/entities/emergencia.entity.js';
import { EmergenciasRepositorio } from '../../../emergencies/domain/repositories/emergencias.repository.js';
import type { Asignacion } from '../../domain/entities/asignacion.entity.js';
import { AsignacionesRepositorio } from '../../domain/repositories/asignaciones.repository.js';
import { ConfiguracionAsignaciones } from '../configuracion_asignaciones.js';

export interface MiServicio {
  turno: Turno | null;
  asignacion: Asignacion | null;
  emergencia: Emergencia | null;
  /** Para que la app resalte "Confirmar llegada" al entrar en el radio. */
  radioLlegadaMetros: number;
}

/** Lo que la app móvil muestra a la tripulación: su turno y el servicio en curso. */
@Injectable()
export class ObtenerMiServicio {
  constructor(
    private readonly turnosRepositorio: TurnosRepositorio,
    private readonly asignacionesRepositorio: AsignacionesRepositorio,
    private readonly emergenciasRepositorio: EmergenciasRepositorio,
    private readonly configuracion: ConfiguracionAsignaciones,
  ) {}

  async ejecutar(usuarioId: string): Promise<MiServicio> {
    const radioLlegadaMetros = this.configuracion.radioLlegadaMetros;
    const turno = await this.turnosRepositorio.buscarActivoDeUsuario(usuarioId);
    if (!turno) {
      return {
        turno: null,
        asignacion: null,
        emergencia: null,
        radioLlegadaMetros,
      };
    }

    const asignacion =
      await this.asignacionesRepositorio.buscarActivaDeAmbulancia(
        turno.ambulanciaId,
      );
    const emergencia = asignacion
      ? await this.emergenciasRepositorio.buscarPorId(asignacion.emergenciaId)
      : null;
    return { turno, asignacion, emergencia, radioLlegadaMetros };
  }
}
