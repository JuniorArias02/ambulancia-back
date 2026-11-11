import type { EstadoAsignacion } from '../../../assignments/domain/entities/asignacion.entity.js';
import type { EstadoEmergencia } from '../../../emergencies/domain/entities/emergencia.entity.js';

/**
 * Solo mientras la ambulancia va hacia el lugar del reporte. La emergencia pasa
 * a `en_atencion` cuando llega la primera: desde ahí el ciudadano ya no la sigue
 * (ni la atención ni el traslado, cuyo destino no es del informante).
 */
export function admiteSeguimiento(estado: EstadoEmergencia): boolean {
  return estado === 'despachada';
}

export const MOTIVOS_SIN_SEGUIMIENTO = [
  'sin_ambulancia_asignada',
  'ambulancia_en_el_lugar',
  'finalizado',
] as const;
export type MotivoSinSeguimiento = (typeof MOTIVOS_SIN_SEGUIMIENTO)[number];

const MOTIVO_POR_ESTADO: Record<EstadoEmergencia, MotivoSinSeguimiento | null> =
  {
    recibida: 'sin_ambulancia_asignada',
    despachada: null,
    en_atencion: 'ambulancia_en_el_lugar',
    cerrada: 'finalizado',
    cancelada: 'finalizado',
  };

export function motivoSinSeguimiento(
  estado: EstadoEmergencia,
): MotivoSinSeguimiento | null {
  return MOTIVO_POR_ESTADO[estado];
}

/** Etapas de una asignación en las que su ambulancia todavía va hacia el lugar. */
export function vaHaciaElLugar(etapa: EstadoAsignacion): boolean {
  return etapa === 'asignada' || etapa === 'en_camino';
}

/** El celular de la tripulación reporta cada 5 s; pasado esto se avisa que el punto es viejo. */
export const ANTIGUEDAD_DESACTUALIZADA_MS = 2 * 60 * 1000;
/**
 * Más vieja que esto no se muestra: un punto de hace horas puede estar en otra
 * ciudad (la web también la da por perdida a los 10 minutos).
 */
export const ANTIGUEDAD_MAXIMA_VISIBLE_MS = 10 * 60 * 1000;

export type VigenciaUbicacion = 'reciente' | 'desactualizada' | 'no_visible';

export function vigenciaUbicacion(
  registradaEn: Date,
  ahora: Date,
): VigenciaUbicacion {
  const antiguedad = ahora.getTime() - registradaEn.getTime();
  if (antiguedad > ANTIGUEDAD_MAXIMA_VISIBLE_MS) return 'no_visible';
  return antiguedad > ANTIGUEDAD_DESACTUALIZADA_MS
    ? 'desactualizada'
    : 'reciente';
}
