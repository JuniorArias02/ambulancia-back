import { fechaColombia } from '../../../common/utils/fecha_colombia.js';
import { etiqueta } from './etiquetas_clinicas.js';
import type { ResumenHistoriaConsulta } from './consulta_clinica.js';

/** Datos mínimos de cada historia del rango, para contar. */
export interface FilaIndicadorHistoria {
  abiertaEn: Date;
  estado: string;
  triage: string | null;
  desenlace: string | null;
  tipoEvento: string | null;
  modalidad: string;
  firmada: boolean;
  riesgoCaidaAlto: boolean;
  pacienteIdentificado: boolean;
  institucion: { id: string; nombre: string } | null;
}

/** Marcas de cada asignación de los ingresos del rango (no canceladas). */
export interface FilaIndicadorServicio {
  asignadaEn: Date;
  llegadaEscenaEn: Date | null;
  salidaEscenaEn: Date | null;
  llegadaDestinoEn: Date | null;
}

export interface Conteo {
  /** `sin_dato` cuando el valor es nulo. */
  clave: string;
  total: number;
}

export interface Estadistica {
  servicios: number;
  promedioSegundos: number | null;
  medianaSegundos: number | null;
  /** El 90 % de los servicios estuvo en este tiempo o menos. */
  p90Segundos: number | null;
}

export interface IndicadoresClinicos {
  rango: { desde: string; hasta: string };
  totalHistorias: number;
  firmadas: number;
  rechazosTraslado: number;
  pacientesSinIdentificar: number;
  conRiesgoCaidaAlto: number;
  porEstado: Conteo[];
  porTriage: Conteo[];
  porDesenlace: Conteo[];
  porModalidad: Conteo[];
  porTipoEvento: Conteo[];
  /** Día de Colombia (AAAA-MM-DD), todos los días del rango, también los de 0. */
  porDia: { dia: string; total: number }[];
  institucionesDestino: { id: string; nombre: string; total: number }[];
  tiempos: {
    respuesta: Estadistica;
    enEscena: Estadistica;
    traslado: Estadistica;
  };
}

/** Rango por defecto: los últimos 30 días, hasta hoy (Colombia). */
export const DIAS_POR_DEFECTO_INDICADORES = 30;

export function contar(valores: readonly (string | null)[]): Conteo[] {
  const conteo = new Map<string, number>();
  for (const v of valores) {
    const clave = v ?? 'sin_dato';
    conteo.set(clave, (conteo.get(clave) ?? 0) + 1);
  }
  return [...conteo.entries()]
    .map(([clave, total]) => ({ clave, total }))
    .sort((a, b) => b.total - a.total || a.clave.localeCompare(b.clave));
}

export function estadistica(valores: readonly number[]): Estadistica {
  if (valores.length === 0) {
    return {
      servicios: 0,
      promedioSegundos: null,
      medianaSegundos: null,
      p90Segundos: null,
    };
  }
  const orden = [...valores].sort((a, b) => a - b);
  const percentil = (p: number) =>
    orden[
      Math.min(orden.length - 1, Math.ceil((p / 100) * orden.length) - 1)
    ] ?? null;
  return {
    servicios: orden.length,
    promedioSegundos: Math.round(
      orden.reduce((suma, v) => suma + v, 0) / orden.length,
    ),
    medianaSegundos: percentil(50),
    p90Segundos: percentil(90),
  };
}

/** Todos los días entre `desde` y `hasta` (incluidos), como AAAA-MM-DD. */
export function diasDelRango(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  const actual = new Date(`${desde}T12:00:00Z`);
  const fin = new Date(`${hasta}T12:00:00Z`);
  while (actual <= fin) {
    dias.push(actual.toISOString().slice(0, 10));
    actual.setUTCDate(actual.getUTCDate() + 1);
  }
  return dias;
}

export function calcularIndicadores(
  rango: { desde: string; hasta: string },
  historias: readonly FilaIndicadorHistoria[],
  servicios: readonly FilaIndicadorServicio[],
): IndicadoresClinicos {
  const porDia = new Map(
    diasDelRango(rango.desde, rango.hasta).map((d) => [d, 0]),
  );
  const instituciones = new Map<
    string,
    { id: string; nombre: string; total: number }
  >();
  for (const h of historias) {
    const dia = fechaColombia(h.abiertaEn);
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
    if (h.institucion) {
      const i = instituciones.get(h.institucion.id) ?? {
        ...h.institucion,
        total: 0,
      };
      i.total++;
      instituciones.set(h.institucion.id, i);
    }
  }
  const segundos = (a: Date | null, b: Date | null) =>
    a && b && b >= a ? (b.getTime() - a.getTime()) / 1000 : null;
  const tiempos = (
    calcular: (s: FilaIndicadorServicio) => number | null,
  ): Estadistica =>
    estadistica(servicios.map(calcular).filter((v): v is number => v !== null));

  return {
    rango,
    totalHistorias: historias.length,
    firmadas: historias.filter((h) => h.firmada).length,
    rechazosTraslado: historias.filter(
      (h) => h.desenlace === 'rechazo_traslado',
    ).length,
    pacientesSinIdentificar: historias.filter((h) => !h.pacienteIdentificado)
      .length,
    conRiesgoCaidaAlto: historias.filter((h) => h.riesgoCaidaAlto).length,
    porEstado: contar(historias.map((h) => h.estado)),
    porTriage: contar(historias.map((h) => h.triage)),
    porDesenlace: contar(historias.map((h) => h.desenlace)),
    porModalidad: contar(historias.map((h) => h.modalidad)),
    porTipoEvento: contar(historias.map((h) => h.tipoEvento)),
    porDia: [...porDia.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dia, total]) => ({ dia, total })),
    institucionesDestino: [...instituciones.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 10),
    tiempos: {
      respuesta: tiempos((s) => segundos(s.asignadaEn, s.llegadaEscenaEn)),
      enEscena: tiempos((s) => segundos(s.llegadaEscenaEn, s.salidaEscenaEn)),
      traslado: tiempos((s) => segundos(s.salidaEscenaEn, s.llegadaDestinoEn)),
    },
  };
}

// ---------------------------------------------------------------------------
// Exportación CSV
// ---------------------------------------------------------------------------

/** Máximo de historias por exportación: más que eso, hay que acotar los filtros. */
export const MAXIMO_FILAS_EXPORTACION = 5000;

const formatoFechaCsv = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function celda(valor: string | number | boolean | null): string {
  if (valor === null) return '';
  const texto =
    typeof valor === 'boolean' ? (valor ? 'Sí' : 'No') : String(valor);
  // Evita que Excel ejecute fórmulas que vengan en los datos.
  const seguro = /^[=+\-@]/.test(texto) ? `'${texto}` : texto;
  return /[";\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/**
 * Las historias en CSV para Excel en español: separador `;`, UTF-8 con BOM,
 * fechas en hora de Colombia y valores con sus etiquetas.
 */
export function historiasACsv(
  historias: readonly ResumenHistoriaConsulta[],
): string {
  const encabezados = [
    'Número de historia',
    'Ingreso',
    'Modalidad',
    'Fecha de atención',
    'Fecha de cierre',
    'Estado',
    'Paciente identificado',
    'Nombres',
    'Apellidos',
    'Tipo de documento',
    'Documento',
    'Sexo',
    'Edad',
    'EPS',
    'Régimen',
    'Triage',
    'Tipo de evento',
    'Desenlace',
    'Ambulancia',
    'Institución de destino',
    'Abierta por',
    'Cerrada por',
    'Firmada',
    'Riesgo de caída alto',
  ];
  const fecha = (f: Date | null) => (f ? formatoFechaCsv.format(f) : null);
  const filas = historias.map((h) =>
    [
      h.numeroHistoria,
      h.ingreso.numeroEmergencia,
      etiqueta('modalidad', h.ingreso.modalidad),
      fecha(h.abiertaEn),
      fecha(h.cerradaEn),
      etiqueta('estado', h.estado),
      h.paciente.identificado,
      h.paciente.nombres,
      h.paciente.apellidos,
      h.paciente.tipoDocumento,
      h.paciente.numeroDocumento,
      etiqueta('sexo', h.paciente.sexo),
      h.paciente.edadAnios,
      h.aseguradoraEps,
      etiqueta('regimen', h.regimenAfiliacion),
      etiqueta('triage', h.triage),
      etiqueta('tipoEvento', h.tipoEvento),
      etiqueta('desenlace', h.desenlace),
      h.ambulancia?.codigo ?? null,
      h.institucionDestino?.nombre ?? null,
      h.creadaPor.nombreCompleto,
      h.cerradaPor?.nombreCompleto ?? null,
      h.firmada,
      h.riesgoCaidaAlto,
    ]
      .map(celda)
      .join(';'),
  );
  return `﻿${[encabezados.join(';'), ...filas].join('\r\n')}\r\n`;
}
