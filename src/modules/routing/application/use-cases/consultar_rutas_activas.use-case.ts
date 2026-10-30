import { Injectable } from '@nestjs/common';
import { AsignacionesRepositorio } from '../../../assignments/domain/repositories/asignaciones.repository.js';
import { RutasAsignacionRepositorio } from '../../domain/repositories/rutas_asignacion.repository.js';
import { ESTADOS_CON_RUTA } from './calcular_ruta_asignacion.use-case.js';
import type { RutaDeAsignacion } from './obtener_ruta_asignacion.use-case.js';

/** Una central no llega a tener tantos servicios en curso a la vez. */
const MAXIMO_SERVICIOS = { pagina: 1, limite: 100 };

/** Para el mapa del despacho: la ruta vigente de cada ambulancia que va hacia una emergencia. */
@Injectable()
export class ConsultarRutasActivas {
  constructor(
    private readonly rutasRepositorio: RutasAsignacionRepositorio,
    private readonly asignacionesRepositorio: AsignacionesRepositorio,
  ) {}

  async ejecutar(): Promise<RutaDeAsignacion[]> {
    const { datos } = await this.asignacionesRepositorio.listar(
      { soloActivas: true },
      MAXIMO_SERVICIOS,
    );
    const enCamino = datos.filter((a) => ESTADOS_CON_RUTA.includes(a.estado));
    const rutas = await this.rutasRepositorio.listarVigentes(
      enCamino.map((a) => a.id),
    );
    const porAsignacion = new Map(rutas.map((r) => [r.asignacionId, r]));

    // Las que aún no tienen ruta (sin GPS reciente) no aparecen.
    return enCamino.flatMap((asignacion) => {
      const ruta = porAsignacion.get(asignacion.id);
      return ruta ? [{ asignacion, ruta }] : [];
    });
  }
}
