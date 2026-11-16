import type { Sexo, TipoDocumento } from './catalogos_clinicos.js';
import type { DatosHistoria } from './entities/historia_clinica.entity.js';
import type { ResumenHistoriaConsulta } from './consulta_clinica.js';

/**
 * Índice de pacientes: une las atenciones de la misma persona por su
 * documento. La historia conserva su propia copia de los datos del paciente
 * (la del momento de la atención); el índice guarda los más recientes.
 */

/** AS y MS ("adulto/menor sin identificación") no identifican a una persona. */
export const DOCUMENTOS_QUE_IDENTIFICAN: readonly TipoDocumento[] = [
  'CC',
  'TI',
  'RC',
  'CE',
  'PA',
  'PEP',
  'PPT',
];

/** Los campos de la historia que, si cambian, actualizan el índice. */
export const CAMPOS_IDENTIDAD = [
  'tipoDocumento',
  'numeroDocumento',
  'nombres',
  'apellidos',
  'sexo',
  'fechaNacimiento',
] as const satisfies readonly (keyof DatosHistoria)[];

export interface DocumentoPaciente {
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
}

/** El documento con el que se enlaza la historia; `null` si no identifica a nadie. */
export function documentoEnlazable(
  datos: Readonly<DatosHistoria>,
): DocumentoPaciente | null {
  const tipo = datos.tipoDocumento;
  const numero = datos.numeroDocumento;
  if (!tipo || !numero || !DOCUMENTOS_QUE_IDENTIFICAN.includes(tipo)) {
    return null;
  }
  return { tipoDocumento: tipo, numeroDocumento: numero };
}

export interface PacienteResumen {
  id: string;
  tipoDocumento: string;
  numeroDocumento: string;
  nombres: string | null;
  apellidos: string | null;
  sexo: Sexo | null;
  fechaNacimiento: Date | null;
  /** A hoy, desde la fecha de nacimiento. */
  edadAnios: number | null;
  totalAtenciones: number;
  ultimaAtencion: Date | null;
  ultimaEps: string | null;
  ultimoRegimen: string | null;
}

/** Un dato reunido de todas las historias, con la historia de donde sale. */
export interface DatoReunido {
  valor: string;
  numeroHistoria: string;
  historiaId: string;
  fecha: Date;
}

export interface FichaPaciente {
  paciente: PacienteResumen;
  /** De la más reciente a la más antigua, incluidas las anuladas. */
  atenciones: ResumenHistoriaConsulta[];
  alergias: DatoReunido[];
  medicamentosHabituales: DatoReunido[];
  antecedentes: DatoReunido[];
  ultimoRiesgoCaida: {
    puntajeTotal: number;
    nivelRiesgo: string;
    evaluadaEn: Date;
    numeroHistoria: string;
  } | null;
}

export interface FiltrosPacientes {
  documento?: string;
  palabrasNombre?: string[];
  pagina: number;
  limite: number;
}

/**
 * Reúne un dato de texto (alergias…) de varias historias: un valor por
 * historia, sin repetir el mismo texto, de la más reciente a la más antigua.
 */
export function reunir(
  historias: readonly {
    id: string;
    numeroHistoria: string;
    abiertaEn: Date;
    valor: string | null;
  }[],
): DatoReunido[] {
  const vistos = new Set<string>();
  const resultado: DatoReunido[] = [];
  for (const h of [...historias].sort(
    (a, b) => b.abiertaEn.getTime() - a.abiertaEn.getTime(),
  )) {
    const valor = h.valor?.trim();
    if (!valor) continue;
    const clave = valor.toLocaleLowerCase('es');
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    resultado.push({
      valor,
      numeroHistoria: h.numeroHistoria,
      historiaId: h.id,
      fecha: h.abiertaEn,
    });
  }
  return resultado;
}
