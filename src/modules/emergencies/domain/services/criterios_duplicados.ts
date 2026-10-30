import { distanciaMetros } from '../../../../common/utils/geografia.js';
import type { Emergencia } from '../entities/emergencia.entity.js';

/**
 * Criterios para sugerir posibles duplicados (arquitectura.md, emergencias):
 * solo se sugieren; un despachador decide si marcar la duplicada.
 */
export const CRITERIOS_DUPLICADOS = {
  /** Se comparan emergencias recibidas hasta esta cantidad de minutos antes. */
  ventanaMinutos: 120,
  radioMetros: 500,
} as const;

export type CriterioCoincidencia =
  'cercania' | 'misma_direccion' | 'mismo_tipo';

export interface PosibleDuplicado {
  emergencia: Emergencia;
  distanciaMetros: number | null;
  criterios: CriterioCoincidencia[];
}

function normalizarDireccion(direccion: string): string {
  return direccion
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Devuelve `null` si la candidata no está cerca ni comparte dirección. */
export function evaluarPosibleDuplicado(
  base: Emergencia,
  candidata: Emergencia,
): PosibleDuplicado | null {
  const criterios: CriterioCoincidencia[] = [];

  const distancia =
    base.coordenadas && candidata.coordenadas
      ? Math.round(distanciaMetros(base.coordenadas, candidata.coordenadas))
      : null;
  if (distancia !== null && distancia <= CRITERIOS_DUPLICADOS.radioMetros) {
    criterios.push('cercania');
  }
  if (
    base.direccion &&
    candidata.direccion &&
    normalizarDireccion(base.direccion) ===
      normalizarDireccion(candidata.direccion)
  ) {
    criterios.push('misma_direccion');
  }
  if (criterios.length === 0) return null;

  if (
    base.tipoIncidente !== null &&
    base.tipoIncidente === candidata.tipoIncidente
  ) {
    criterios.push('mismo_tipo');
  }
  return { emergencia: candidata, distanciaMetros: distancia, criterios };
}
