import {
  distanciaMetros,
  type PuntoGeografico,
} from '../../../../common/utils/geografia.js';

export interface VerificacionLlegada {
  /** null si la emergencia no tiene coordenadas: no hay contra qué comparar. */
  distanciaMetros: number | null;
  dentroDelRadio: boolean;
}

/**
 * El radio es una referencia, no un disparador: la llegada siempre la
 * confirma el conductor. Sin coordenadas de la emergencia no se puede
 * verificar y se acepta la palabra del conductor.
 */
export function verificarLlegada(
  posicion: PuntoGeografico,
  escena: PuntoGeografico | null,
  radioMetros: number,
): VerificacionLlegada {
  if (!escena) return { distanciaMetros: null, dentroDelRadio: true };
  const distancia = Math.round(distanciaMetros(posicion, escena) * 10) / 10;
  return {
    distanciaMetros: distancia,
    dentroDelRadio: distancia <= radioMetros,
  };
}
