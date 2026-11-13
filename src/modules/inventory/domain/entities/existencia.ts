import type { EstadoEquipo } from './equipo.entity.js';
import type { TipoUbicacion } from './ubicacion_inventario.entity.js';

/**
 * Cantidad de una unidad (insumo, lote o equipo) en una ubicación. Es solo
 * lectura: únicamente la cambian los movimientos confirmados.
 */
export interface Existencia {
  id: string;
  ubicacionId: string;
  ubicacionTipo: TipoUbicacion;
  ubicacionNombre: string | null;
  insumoId: string;
  insumoCodigo: string;
  insumoNombre: string;
  unidadMedida: string;
  loteId: string | null;
  numeroLote: string | null;
  loteVencimiento: string | null;
  equipoId: string | null;
  numeroSerie: string | null;
  equipoEstado: EstadoEquipo | null;
  claveControl: string;
  cantidad: number;
  actualizadaEn: Date;
}

/** Se puede usar con un paciente: ni vencido ni un equipo fuera de operación. */
export function esUtilizable(existencia: Existencia, hoy: string): boolean {
  if (existencia.loteVencimiento !== null && existencia.loteVencimiento < hoy) {
    return false;
  }
  return (
    existencia.equipoEstado === null || existencia.equipoEstado === 'operativo'
  );
}

export function describirExistencia(existencia: Existencia): string {
  if (existencia.numeroSerie) {
    return `${existencia.insumoNombre} (serie ${existencia.numeroSerie})`;
  }
  if (existencia.numeroLote) {
    return `${existencia.insumoNombre} (lote ${existencia.numeroLote})`;
  }
  return existencia.insumoNombre;
}
