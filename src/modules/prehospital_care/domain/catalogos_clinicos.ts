/** Valores permitidos en la historia clínica prehospitalaria. */

export const ESTADOS_HISTORIA = ['borrador', 'cerrada', 'anulada'] as const;
export type EstadoHistoria = (typeof ESTADOS_HISTORIA)[number];

/** Documentos de identidad de personas en Colombia (AS/MS: adulto o menor sin identificación). */
export const TIPOS_DOCUMENTO = [
  'CC',
  'TI',
  'RC',
  'CE',
  'PA',
  'PEP',
  'PPT',
  'AS',
  'MS',
] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export const SEXOS = ['masculino', 'femenino', 'indeterminado'] as const;
export type Sexo = (typeof SEXOS)[number];

export const TIPOS_EVENTO = [
  'transito',
  'caida',
  'arma_fuego',
  'arma_blanca',
  'quemadura',
  'clinico',
  'otro',
] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

/** Solo en tránsito. */
export const ROLES_VICTIMA = [
  'conductor',
  'pasajero',
  'peaton',
  'motociclista',
  'ciclista',
] as const;
export type RolVictima = (typeof ROLES_VICTIMA)[number];

export const TRIAGES = ['rojo', 'amarillo', 'verde', 'negro'] as const;
export type Triage = (typeof TRIAGES)[number];

export const DESENLACES = [
  'trasladado',
  'rechazo_traslado',
  'atendido_en_sitio',
  'fallecido_en_sitio',
] as const;
export type Desenlace = (typeof DESENLACES)[number];

export const REGIONES_CORPORALES = [
  'cabeza',
  'cara',
  'cuello',
  'torax',
  'abdomen',
  'espalda',
  'pelvis',
  'miembro_superior_derecho',
  'miembro_superior_izquierdo',
  'miembro_inferior_derecho',
  'miembro_inferior_izquierdo',
  'generalizada',
] as const;
export type RegionCorporal = (typeof REGIONES_CORPORALES)[number];

export const TIPOS_LESION = [
  'herida',
  'fractura',
  'quemadura',
  'amputacion',
  'contusion',
  'luxacion',
  'trauma_cerrado',
  'otra',
] as const;
export type TipoLesion = (typeof TIPOS_LESION)[number];

export const TIPOS_INTERVENCION = ['procedimiento', 'medicamento'] as const;
export type TipoIntervencion = (typeof TIPOS_INTERVENCION)[number];
