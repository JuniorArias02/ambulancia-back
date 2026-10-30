import type { RutaAsignacion } from '../entities/ruta_asignacion.entity.js';

export abstract class RutasAsignacionRepositorio {
  /** Agrega un cálculo nuevo; los anteriores quedan como historial. */
  abstract guardar(ruta: RutaAsignacion): Promise<RutaAsignacion>;
  /** La ruta más reciente del servicio. */
  abstract buscarVigente(asignacionId: string): Promise<RutaAsignacion | null>;
  /** La más reciente de cada servicio indicado. */
  abstract listarVigentes(
    asignacionIds: readonly string[],
  ): Promise<RutaAsignacion[]>;
}
