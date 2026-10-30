export abstract class ConfiguracionAsignaciones {
  /**
   * Radio de referencia para confirmar la llegada a la escena. No dispara
   * nada solo: el conductor confirma y, fuera del radio, debe justificarlo.
   */
  abstract readonly radioLlegadaMetros: number;
}
