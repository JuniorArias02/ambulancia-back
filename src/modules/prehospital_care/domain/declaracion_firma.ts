/**
 * Texto que acepta el profesional al firmar electrónicamente el cierre de la
 * historia. Si el texto cambia, se sube la versión: la auditoría guarda cuál
 * aceptó cada firma.
 */
export const DECLARACION_FIRMA_HISTORIA = {
  version: 'v1',
  texto:
    'Declaro que la información registrada en esta historia clínica de atención prehospitalaria es veraz y corresponde a la atención que presté. La firmo electrónicamente con mis credenciales personales e intransferibles y entiendo que, una vez firmada, no podrá modificarse.',
} as const;

/** Cómo se comprobó la identidad de quien firma. */
export const METODO_FIRMA_HISTORIA = 'reautenticacion_contrasena';
