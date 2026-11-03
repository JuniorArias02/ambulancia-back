import type { RutaAsignacion } from '../entities/ruta_asignacion.entity.js';

export abstract class RutasAsignacionRepositorio {
  /** Agrega un cálculo nuevo; los anteriores quedan como historial. */
  abstract guardar(ruta: RutaAsignacion): Promise<RutaAsignacion>;
  /** La ruta más reciente del servicio; `esVigentePara` dice si todavía sirve. */
  abstract buscarVigente(asignacionId: string): Promise<RutaAsignacion | null>;
  /** La más reciente de cada servicio indicado; aplica lo mismo. */
  abstract listarVigentes(
    asignacionIds: readonly string[],
  ): Promise<RutaAsignacion[]>;
}
