import type { PerfilDotacion } from '../entities/perfil_dotacion.entity.js';
import { type Existencia, esUtilizable } from '../entities/existencia.js';
import { redondearCantidad } from './validaciones.js';

export const ESTADOS_DOTACION = [
  'completo',
  'incompleto',
  'bajo_minimo',
] as const;
export type EstadoDotacion = (typeof ESTADOS_DOTACION)[number];

interface TotalesInsumo {
  insumoId: string;
  insumoCodigo: string;
  insumoNombre: string;
  unidadMedida: string;
  /** Se puede usar: sin vencer y, si es equipo, operativo. */
  disponible: number;
  /** Está en la ambulancia pero vencido o fuera de operación. */
  noUtilizable: number;
}

export interface ItemDotacion extends TotalesInsumo {
  detallePerfilId: string;
  cantidadRequerida: number;
  cantidadMinima: number | null;
  obligatorio: boolean;
  faltante: number;
  estado: EstadoDotacion;
}

export interface ComparacionDotacion {
  items: ItemDotacion[];
  /** Lo que hay en la ubicación y el perfil no pide. */
  adicionales: TotalesInsumo[];
  /** Todos los obligatorios completos. Sin perfil vigente, `null`. */
  completa: boolean | null;
}

function totalizar(
  existencias: readonly Existencia[],
  hoy: string,
): Map<string, TotalesInsumo> {
  const totales = new Map<string, TotalesInsumo>();
  for (const existencia of existencias) {
    const total = totales.get(existencia.insumoId) ?? {
      insumoId: existencia.insumoId,
      insumoCodigo: existencia.insumoCodigo,
      insumoNombre: existencia.insumoNombre,
      unidadMedida: existencia.unidadMedida,
      disponible: 0,
      noUtilizable: 0,
    };
    if (esUtilizable(existencia, hoy)) {
      total.disponible = redondearCantidad(
        total.disponible + existencia.cantidad,
      );
    } else {
      total.noUtilizable = redondearCantidad(
        total.noUtilizable + existencia.cantidad,
      );
    }
    totales.set(existencia.insumoId, total);
  }
  return totales;
}

/**
 * Compara lo que hay (sin contar vencidos ni equipos fuera de operación) con
 * lo que pide el perfil. Bajo el mínimo es crítico; entre el mínimo y lo
 * requerido, incompleto.
 */
export function compararDotacion(
  perfil: PerfilDotacion | null,
  existencias: readonly Existencia[],
  hoy: string,
): ComparacionDotacion {
  const totales = totalizar(existencias, hoy);
  if (!perfil) {
    return { items: [], adicionales: [...totales.values()], completa: null };
  }

  const items = perfil.detalles.map((detalle): ItemDotacion => {
    const total = totales.get(detalle.insumoId);
    const disponible = total?.disponible ?? 0;
    const minimo = detalle.cantidadMinima ?? detalle.cantidadRequerida;
    const estado: EstadoDotacion =
      disponible >= detalle.cantidadRequerida
        ? 'completo'
        : disponible >= minimo
          ? 'incompleto'
          : 'bajo_minimo';
    return {
      insumoId: detalle.insumoId,
      insumoCodigo: detalle.insumoCodigo,
      insumoNombre: detalle.insumoNombre,
      unidadMedida: detalle.unidadMedida,
      disponible,
      noUtilizable: total?.noUtilizable ?? 0,
      detallePerfilId: detalle.id,
      cantidadRequerida: detalle.cantidadRequerida,
      cantidadMinima: detalle.cantidadMinima,
      obligatorio: detalle.obligatorio,
      faltante: redondearCantidad(
        Math.max(0, detalle.cantidadRequerida - disponible),
      ),
      estado,
    };
  });

  return {
    items,
    adicionales: [...totales.values()].filter(
      (t) => !perfil.buscarDetalleDeInsumo(t.insumoId),
    ),
    completa: items.every((i) => !i.obligatorio || i.estado === 'completo'),
  };
}
