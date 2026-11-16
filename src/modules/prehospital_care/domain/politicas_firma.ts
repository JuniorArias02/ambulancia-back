import type { ModalidadServicio } from '../../emergencies/domain/entities/emergencia.entity.js';
import type { Desenlace } from './catalogos_clinicos.js';
import type { ResumenFirmaHistoria } from './entities/firma_historia.js';

/**
 * Qué firmas exige la historia según la modalidad del servicio. Por ahora
 * son valores fijos; que cada empresa los edite queda para después.
 *
 * - `obligatoria`: debe haber firma (con imagen).
 * - `si_es_posible`: firma, o el motivo por el que nadie pudo firmar.
 * - `opcional`: no se exige.
 *
 * El disentimiento (rechazo del traslado) es siempre obligatorio.
 */
export type ExigenciaFirma = 'obligatoria' | 'si_es_posible' | 'opcional';

export interface PoliticaFirmas {
  /** Comprobante de atención del paciente o su acudiente. */
  comprobante: ExigenciaFirma;
  /** Firma de quien recibe en la institución (solo si fue trasladado). */
  receptor: Exclude<ExigenciaFirma, 'si_es_posible'>;
}

export const POLITICAS_FIRMA: Readonly<
  Record<ModalidadServicio, PoliticaFirmas>
> = {
  emergencia: { comprobante: 'si_es_posible', receptor: 'opcional' },
  accidente_transito: { comprobante: 'si_es_posible', receptor: 'opcional' },
  // Soporte para la EPS: el paciente o su acudiente firman siempre.
  traslado_programado: { comprobante: 'obligatoria', receptor: 'obligatoria' },
  traslado_interhospitalario: {
    comprobante: 'si_es_posible',
    receptor: 'obligatoria',
  },
  atencion_en_sitio: { comprobante: 'si_es_posible', receptor: 'opcional' },
};

/** Lo que falta en firmas para poder cerrar, con los mismos textos de `faltantesParaCerrar`. */
export function faltantesDeFirmas(
  modalidad: ModalidadServicio,
  desenlace: Desenlace | null,
  firmas: readonly ResumenFirmaHistoria[],
): string[] {
  if (!desenlace || desenlace === 'fallecido_en_sitio') return [];
  const politica = POLITICAS_FIRMA[modalidad];
  const de = (proposito: ResumenFirmaHistoria['proposito']) =>
    firmas.filter((f) => f.proposito === proposito);
  const firmadaPorPacienteOAcudiente = (lista: ResumenFirmaHistoria[]) =>
    lista.some(
      (f) =>
        f.conImagen &&
        (f.rolFirmante === 'paciente' || f.rolFirmante === 'acudiente'),
    );
  const motivo = (lista: ResumenFirmaHistoria[]) =>
    lista.find((f) => f.rolFirmante === 'paciente' && f.motivoSinFirma)
      ?.motivoSinFirma ?? null;
  const faltantes: string[] = [];

  if (desenlace === 'rechazo_traslado') {
    const disentimiento = de('disentimiento');
    if (!firmadaPorPacienteOAcudiente(disentimiento)) {
      const sinFirma = motivo(disentimiento);
      if (!sinFirma) {
        faltantes.push(
          'firma del disentimiento (paciente o familiar), o el motivo por el que no firmó',
        );
      } else if (
        sinFirma === 'se_nego' &&
        !disentimiento.some((f) => f.rolFirmante === 'testigo' && f.conImagen)
      ) {
        faltantes.push(
          'firma de un testigo: el paciente se negó a firmar el disentimiento',
        );
      }
    }
    return faltantes;
  }

  const comprobante = de('comprobante_atencion');
  if (
    politica.comprobante === 'obligatoria' &&
    !firmadaPorPacienteOAcudiente(comprobante)
  ) {
    faltantes.push(
      'firma del comprobante de atención (paciente o familiar), obligatoria en esta modalidad',
    );
  }
  if (
    politica.comprobante === 'si_es_posible' &&
    !firmadaPorPacienteOAcudiente(comprobante) &&
    !motivo(comprobante)
  ) {
    faltantes.push(
      'firma del comprobante de atención (paciente o familiar), o el motivo por el que no firmó',
    );
  }
  if (
    desenlace === 'trasladado' &&
    politica.receptor === 'obligatoria' &&
    !de('entrega').some((f) => f.rolFirmante === 'receptor' && f.conImagen)
  ) {
    faltantes.push('firma de quien recibe al paciente en la institución');
  }
  return faltantes;
}
