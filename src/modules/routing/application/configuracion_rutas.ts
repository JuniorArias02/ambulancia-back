export abstract class ConfiguracionRutas {
  /** A cuántos metros de la ruta se considera que la ambulancia se desvió. */
  abstract readonly distanciaDesvioMetros: number;
  /** Mínimo entre dos recálculos del mismo servicio. */
  abstract readonly intervaloRecalculoMs: number;
}
