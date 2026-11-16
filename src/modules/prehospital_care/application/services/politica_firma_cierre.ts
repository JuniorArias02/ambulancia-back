/**
 * Si al cerrar se exigen las firmas: la registrada del profesional y las
 * que pida la modalidad (paciente o familiar, testigo, receptor).
 * Viene de `FIRMA_CIERRE_OBLIGATORIA`: `false` solo durante la transición,
 * mientras todos los profesionales la registran.
 */
export class PoliticaFirmaCierre {
  constructor(readonly exigeFirmaRegistrada: boolean) {}
}
