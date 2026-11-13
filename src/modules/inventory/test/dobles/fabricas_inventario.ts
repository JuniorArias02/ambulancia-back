import { Equipo } from '../../domain/entities/equipo.entity.js';
import type { Existencia } from '../../domain/entities/existencia.js';
import {
  type DatosInsumo,
  Insumo,
} from '../../domain/entities/insumo.entity.js';
import { Lote } from '../../domain/entities/lote.entity.js';
import { UbicacionInventario } from '../../domain/entities/ubicacion_inventario.entity.js';

export const AHORA = new Date('2026-11-11T15:00:00.000Z');
export const HOY = '2026-11-11';

export function crearInsumo(cambios: Partial<DatosInsumo> = {}): Insumo {
  return Insumo.crear(
    {
      codigo: 'ins-1',
      nombre: 'Gasa estéril',
      descripcion: null,
      tipo: 'insumo_asistencial',
      categoria: null,
      unidadMedida: 'unidad',
      marca: null,
      fabricante: null,
      requiereLote: false,
      requiereVencimiento: false,
      requiereRegistroSanitario: false,
      requiereSerie: false,
      esControlEspecial: false,
      stockMinimo: 0,
      ...cambios,
    },
    AHORA,
  );
}

export const insumoPorLote = (cambios: Partial<DatosInsumo> = {}) =>
  crearInsumo({
    codigo: 'med-1',
    nombre: 'Adrenalina 1 mg',
    tipo: 'medicamento',
    requiereLote: true,
    requiereVencimiento: true,
    ...cambios,
  });

export const insumoPorSerie = () =>
  crearInsumo({
    codigo: 'eq-1',
    nombre: 'Desfibrilador DEA',
    tipo: 'equipo_biomedico',
    requiereSerie: true,
  });

export function crearLote(
  insumo: Insumo,
  fechaVencimiento = '2027-06-30',
  numero = 'L-1',
): Lote {
  return Lote.crear(
    insumo,
    null,
    {
      numeroLote: numero,
      recibidoEn: null,
      fechaFabricacion: '2026-01-01',
      fechaVencimiento,
      fabricante: null,
      proveedor: null,
      documentoSoporte: null,
      observaciones: null,
    },
    AHORA,
    HOY,
  );
}

/** Un lote ya vencido (se reconstruye: crear uno vencido hoy es válido, pero así es explícito). */
export function loteVencido(insumo: Insumo): Lote {
  const lote = crearLote(insumo, '2027-01-01', 'L-VENCIDO');
  return Lote.reconstruir({
    id: lote.id,
    insumoId: insumo.id,
    registroSanitarioId: null,
    numeroLote: 'L-VENCIDO',
    fechaFabricacion: '2025-01-01',
    fechaVencimiento: '2026-10-01',
    fabricante: null,
    proveedor: null,
    recibidoEn: null,
    documentoSoporte: null,
    observaciones: null,
    creadoEn: AHORA,
    insumoNombre: insumo.nombre,
    requiereVencimiento: true,
  });
}

export function crearEquipo(insumo: Insumo, serie = 'SER-1'): Equipo {
  return Equipo.crear(
    insumo,
    null,
    {
      numeroSerie: serie,
      marca: null,
      modelo: null,
      fechaAdquisicion: null,
      fechaProximoMantenimiento: null,
      observaciones: null,
    },
    AHORA,
    HOY,
  );
}

export const bodega = () => UbicacionInventario.deBodega('bodega-1', AHORA);
export const ambulancia = (id = 'amb-1') =>
  UbicacionInventario.deAmbulancia(id, AHORA);

export function existencia(
  cambios: Partial<Existencia> & Pick<Existencia, 'insumoId' | 'cantidad'>,
): Existencia {
  return {
    id: crypto.randomUUID(),
    ubicacionId: 'ubi-1',
    ubicacionTipo: 'ambulancia',
    ubicacionNombre: 'AMB-01',
    insumoCodigo: 'X',
    insumoNombre: 'Insumo',
    unidadMedida: 'unidad',
    loteId: null,
    numeroLote: null,
    loteVencimiento: null,
    equipoId: null,
    numeroSerie: null,
    equipoEstado: null,
    claveControl: `insumo:${cambios.insumoId}`,
    actualizadaEn: AHORA,
    ...cambios,
  };
}
