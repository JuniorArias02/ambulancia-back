import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type { Equipo } from '../entities/equipo.entity.js';
import type { Insumo } from '../entities/insumo.entity.js';
import type { Lote } from '../entities/lote.entity.js';

/** Qué se está contando o moviendo: el insumo y, según su control, el lote o el equipo. */
export interface ReferenciaUnidad {
  insumo: Insumo;
  lote: Lote | null;
  equipo: Equipo | null;
}

export interface UnidadIdentificada {
  insumoId: string;
  loteId: string | null;
  equipoId: string | null;
  /** La misma que usa `inv_existencias.clave_control`. */
  claveControl: string;
}

export function claveControl(
  insumoId: string,
  loteId: string | null,
  equipoId: string | null,
): string {
  if (equipoId) return `equipo:${equipoId}`;
  if (loteId) return `lote:${loteId}`;
  return `insumo:${insumoId}`;
}

/**
 * Valida que el lote o el equipo correspondan al control del insumo:
 * por serie exige el equipo, por lote exige el lote y si no, ninguno de los dos.
 */
export function identificarUnidad({
  insumo,
  lote,
  equipo,
}: ReferenciaUnidad): UnidadIdentificada {
  if (lote && lote.insumoId !== insumo.id) {
    throw new ReglaNegocioError(
      `El lote ${lote.numeroLote} no pertenece a "${insumo.nombre}"`,
    );
  }
  if (equipo && equipo.insumoId !== insumo.id) {
    throw new ReglaNegocioError(
      `El equipo ${equipo.numeroSerie} no pertenece a "${insumo.nombre}"`,
    );
  }

  switch (insumo.control) {
    case 'serie':
      if (!equipo || lote) {
        throw new ReglaNegocioError(
          `"${insumo.nombre}" se identifica por número de serie: indique el equipo`,
        );
      }
      break;
    case 'lote':
      if (!lote || equipo) {
        throw new ReglaNegocioError(
          `"${insumo.nombre}" se controla por lote: indique el lote`,
        );
      }
      break;
    case 'insumo':
      if (lote || equipo) {
        throw new ReglaNegocioError(
          `"${insumo.nombre}" no se controla por lote ni por serie`,
        );
      }
  }

  const loteId = lote?.id ?? null;
  const equipoId = equipo?.id ?? null;
  return {
    insumoId: insumo.id,
    loteId,
    equipoId,
    claveControl: claveControl(insumo.id, loteId, equipoId),
  };
}
