import type { EstadoEquipo } from '../entities/equipo.entity.js';

export interface LoteEnRiesgo {
  loteId: string;
  numeroLote: string;
  fechaVencimiento: string;
  insumoId: string;
  insumoNombre: string;
  ubicacionId: string;
  ubicacionNombre: string | null;
  cantidad: number;
}

export interface EquipoPorMantenimiento {
  equipoId: string;
  numeroSerie: string;
  insumoNombre: string;
  estado: EstadoEquipo;
  fechaProximoMantenimiento: string;
}

export interface RegistroPorVencer {
  registroId: string;
  numeroRegistro: string;
  insumoId: string;
  insumoNombre: string;
  fechaVencimiento: string;
}

export interface InsumoBajoMinimo {
  insumoId: string;
  insumoCodigo: string;
  insumoNombre: string;
  unidadMedida: string;
  stockMinimo: number;
  /** Suma en las bodegas activas. */
  enBodegas: number;
}

export interface AlertasInventario {
  lotesPorVencer: LoteEnRiesgo[];
  equiposPorMantenimiento: EquipoPorMantenimiento[];
  registrosPorVencer: RegistroPorVencer[];
  insumosBajoMinimo: InsumoBajoMinimo[];
}

/** Consultas de lectura para el tablero de la bodega. */
export abstract class AlertasInventarioRepositorio {
  /** Todo lo que vence o toca mantenimiento hasta `limite` ("AAAA-MM-DD"). */
  abstract obtener(limite: string): Promise<AlertasInventario>;
}
