import type { DatosHistoria } from '../entities/historia_clinica.entity.js';

/** Mantiene el índice de pacientes al día con lo que se guarda en las historias. */
export abstract class IndicePacientes {
  /**
   * Si la historia tiene un documento que identifica a la persona, busca o
   * crea el paciente con los datos más recientes y enlaza la historia; si no,
   * la deja sin paciente.
   */
  abstract enlazar(
    historiaId: string,
    datos: Readonly<DatosHistoria>,
  ): Promise<void>;
}
