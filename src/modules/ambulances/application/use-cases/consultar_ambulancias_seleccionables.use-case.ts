import { Injectable } from '@nestjs/common';
import { AccesoDenegadoError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import type { Ambulancia } from '../../domain/entities/ambulancia.entity.js';
import {
  type MotivoNoSeleccionable,
  motivoNoSeleccionable,
} from '../../domain/entities/seleccion_ambulancia.js';
import { Turno } from '../../domain/entities/turno.entity.js';
import { AmbulanciasRepositorio } from '../../domain/repositories/ambulancias.repository.js';
import { TurnosRepositorio } from '../../domain/repositories/turnos.repository.js';

export interface AmbulanciaSeleccionable {
  ambulancia: Ambulancia;
  turno: Turno | null;
  esMia: boolean;
  motivoNoSeleccionable: MotivoNoSeleccionable | null;
}

/** Toda la flota, con lo que el conductor o el paramédico necesita para elegir. */
@Injectable()
export class ConsultarAmbulanciasSeleccionables {
  constructor(
    private readonly ambulanciasRepositorio: AmbulanciasRepositorio,
    private readonly turnosRepositorio: TurnosRepositorio,
  ) {}

  async ejecutar(
    contexto: ContextoSolicitud,
  ): Promise<AmbulanciaSeleccionable[]> {
    const funcion = contexto.rol ? Turno.funcionDelRol(contexto.rol) : null;
    if (!funcion || !contexto.usuarioId) {
      throw new AccesoDenegadoError(
        'Solo un conductor o un paramédico puede seleccionar una ambulancia',
      );
    }
    const usuarioId = contexto.usuarioId;

    const [ambulancias, turnos] = await Promise.all([
      this.ambulanciasRepositorio.listarTodas(),
      this.turnosRepositorio.listarActivos(),
    ]);
    const turnoPorAmbulancia = new Map(
      turnos.map((turno) => [turno.ambulanciaId, turno]),
    );

    const yaTieneAmbulancia = turnos.some((turno) => turno.incluyeA(usuarioId));

    return ambulancias.map((ambulancia) => {
      const turno = turnoPorAmbulancia.get(ambulancia.id) ?? null;
      const esMia = turno?.incluyeA(usuarioId) ?? false;
      return {
        ambulancia,
        turno,
        esMia,
        motivoNoSeleccionable: esMia
          ? null
          : yaTieneAmbulancia
            ? 'ya_en_otra_ambulancia'
            : motivoNoSeleccionable(ambulancia, turno, funcion),
      };
    });
  }
}
