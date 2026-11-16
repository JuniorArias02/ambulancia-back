import { ReglaNegocioError } from '../../../common/exceptions/errores_dominio.js';
import { inicioDiaColombia } from '../../../common/utils/fecha_colombia.js';
import type { ModalidadServicio } from '../../emergencies/domain/entities/emergencia.entity.js';
import type {
  Desenlace,
  EstadoHistoria,
  RegimenAfiliacion,
  Sexo,
  TipoDocumento,
  TipoEvento,
  Triage,
} from './catalogos_clinicos.js';

/**
 * Consulta clínica (web, solo lectura): búsqueda de historias, el ingreso o
 * servicio completo y la trazabilidad. Son vistas armadas para consultar;
 * las historias se escriben con `HistoriaClinica`.
 */

// ---------------------------------------------------------------------------
// Búsqueda
// ---------------------------------------------------------------------------

/** Sobre qué fecha se filtra y se ordena. */
export const CAMPOS_FECHA_CONSULTA = ['atencion', 'evento', 'cierre'] as const;
export type CampoFechaConsulta = (typeof CAMPOS_FECHA_CONSULTA)[number];

export const ORDENES_CONSULTA = [
  'fecha_desc',
  'fecha_asc',
  'numero',
  'paciente',
] as const;
export type OrdenConsulta = (typeof ORDENES_CONSULTA)[number];

/** `vigentes` (por defecto) = borrador + cerrada; las anuladas se piden aparte. */
export const ESTADOS_FILTRO_CONSULTA = [
  'vigentes',
  'borrador',
  'cerrada',
  'anulada',
  'todos',
] as const;
export type EstadoFiltroConsulta = (typeof ESTADOS_FILTRO_CONSULTA)[number];

/** Rango máximo de una búsqueda por fechas. */
export const DIAS_MAXIMOS_RANGO = 366;

export interface RangoFechas {
  /** Inicio del día `desde` en Colombia (incluido). */
  desde: Date | null;
  /** Inicio del día siguiente a `hasta` en Colombia (excluido). */
  hastaExclusivo: Date | null;
}

export interface FiltrosBusquedaHistorias {
  rango: RangoFechas;
  campoFecha: CampoFechaConsulta;
  ingreso?: string;
  numeroHistoria?: string;
  documento?: string;
  /** Palabras del nombre; cada una debe coincidir con el inicio de una palabra de nombres o apellidos. */
  palabrasNombre?: string[];
  soloNn?: boolean;
  estados: EstadoHistoria[];
  triage?: Triage;
  desenlace?: Desenlace;
  tipoEvento?: TipoEvento;
  riesgoCaidaAlto?: boolean;
  firmada?: boolean;
  ambulanciaId?: string;
  institucionDestinoId?: string;
  profesionalId?: string;
  eps?: string;
  regimen?: RegimenAfiliacion;
  modalidad?: ModalidadServicio;
  orden: OrdenConsulta;
  pagina: number;
  limite: number;
}

/** Días `AAAA-MM-DD` de Colombia → instantes UTC. Valida el orden y el tamaño del rango. */
export function rangoDesdeDias(
  desde: string | undefined,
  hasta: string | undefined,
): RangoFechas {
  const inicio = desde ? inicioDiaColombia(desde) : null;
  const finDia = hasta ? inicioDiaColombia(hasta) : null;
  if ((desde && !inicio) || (hasta && !finDia)) {
    throw new ReglaNegocioError('La fecha no existe en el calendario');
  }
  const hastaExclusivo = finDia
    ? new Date(finDia.getTime() + 24 * 60 * 60 * 1000)
    : null;
  if (inicio && hastaExclusivo) {
    if (inicio >= hastaExclusivo) {
      throw new ReglaNegocioError('"desde" no puede ser posterior a "hasta"');
    }
    const dias = (hastaExclusivo.getTime() - inicio.getTime()) / 86_400_000;
    if (dias > DIAS_MAXIMOS_RANGO) {
      throw new ReglaNegocioError(
        `El rango de fechas no puede superar ${DIAS_MAXIMOS_RANGO} días`,
      );
    }
  }
  return { desde: inicio, hastaExclusivo };
}

export function estadosDelFiltro(
  filtro: EstadoFiltroConsulta | undefined,
): EstadoHistoria[] {
  switch (filtro ?? 'vigentes') {
    case 'vigentes':
      return ['borrador', 'cerrada'];
    case 'todos':
      return ['borrador', 'cerrada', 'anulada'];
    case 'borrador':
      return ['borrador'];
    case 'cerrada':
      return ['cerrada'];
    case 'anulada':
      return ['anulada'];
  }
}

/** "  juan  Pérez " → ["juan", "Pérez"]; ignora palabras de una letra. */
export function palabrasDeNombre(nombre: string | undefined): string[] {
  return (nombre ?? '')
    .trim()
    .split(/\s+/)
    .filter((p) => p.length >= 2)
    .slice(0, 4);
}

/** Igual que se guarda en la historia: sin espacios, puntos ni guiones, en mayúsculas. */
export function normalizarDocumento(documento: string): string {
  return documento.replace(/[\s.-]/g, '').toUpperCase();
}

export interface PersonaConsulta {
  id: string;
  nombreCompleto: string | null;
}

export interface PacienteConsulta {
  identificado: boolean;
  nombres: string | null;
  apellidos: string | null;
  tipoDocumento: TipoDocumento | null;
  numeroDocumento: string | null;
  sexo: Sexo | null;
  fechaNacimiento: Date | null;
  edadAproximada: number | null;
  /** Calculada a la fecha de la atención; si no hay fecha de nacimiento, la aproximada. */
  edadAnios: number | null;
}

export interface ResumenHistoriaConsulta {
  id: string;
  numeroHistoria: string;
  estado: EstadoHistoria;
  abiertaEn: Date;
  horaEvento: Date | null;
  cerradaEn: Date | null;
  paciente: PacienteConsulta;
  triage: Triage | null;
  desenlace: Desenlace | null;
  tipoEvento: TipoEvento | null;
  impresionDiagnostica: string | null;
  aseguradoraEps: string | null;
  regimenAfiliacion: RegimenAfiliacion | null;
  ingreso: {
    emergenciaId: string;
    numeroEmergencia: string;
    modalidad: ModalidadServicio;
  };
  ambulancia: { id: string; codigo: string; placa: string } | null;
  institucionDestino: { id: string; nombre: string } | null;
  creadaPor: PersonaConsulta;
  cerradaPor: PersonaConsulta | null;
  firmada: boolean;
  /** Alguna valoración Downton de la historia dio riesgo alto. */
  riesgoCaidaAlto: boolean;
  totales: {
    signosVitales: number;
    lesiones: number;
    intervenciones: number;
    valoracionesDownton: number;
  };
}

/** Años cumplidos en `referencia`. */
export function edadEnAnios(nacimiento: Date, referencia: Date): number {
  let edad = referencia.getUTCFullYear() - nacimiento.getUTCFullYear();
  const mes = referencia.getUTCMonth() - nacimiento.getUTCMonth();
  if (
    mes < 0 ||
    (mes === 0 && referencia.getUTCDate() < nacimiento.getUTCDate())
  ) {
    edad--;
  }
  return Math.max(0, edad);
}

/** Nombres de los filtros usados, para la auditoría: nunca sus valores. */
export function filtrosUsados(filtros: FiltrosBusquedaHistorias): string[] {
  const usados: string[] = [];
  if (filtros.rango.desde || filtros.rango.hastaExclusivo) {
    usados.push(`fecha_${filtros.campoFecha}`);
  }
  const opcionales = [
    'ingreso',
    'numeroHistoria',
    'documento',
    'palabrasNombre',
    'soloNn',
    'triage',
    'desenlace',
    'tipoEvento',
    'riesgoCaidaAlto',
    'firmada',
    'ambulanciaId',
    'institucionDestinoId',
    'profesionalId',
    'eps',
    'regimen',
    'modalidad',
  ] as const satisfies readonly (keyof FiltrosBusquedaHistorias)[];
  for (const clave of opcionales) {
    const valor = filtros[clave];
    if (valor !== undefined && !(Array.isArray(valor) && valor.length === 0)) {
      usados.push(clave === 'palabrasNombre' ? 'nombre' : clave);
    }
  }
  return usados;
}

// ---------------------------------------------------------------------------
// Ingreso o servicio
// ---------------------------------------------------------------------------

export interface EmergenciaIngreso {
  id: string;
  numeroEmergencia: string;
  fuente: string;
  modalidad: ModalidadServicio;
  estado: string;
  descripcion: string;
  tipoIncidente: string | null;
  prioridad: string | null;
  direccion: string | null;
  referenciaLugar: string | null;
  latitud: number | null;
  longitud: number | null;
  origenUbicacion: string | null;
  numeroVictimas: number | null;
  informanteNombre: string | null;
  informanteTelefono: string | null;
  reportadaDesdeApp: boolean;
  recibidaEn: Date;
  cerradaEn: Date | null;
  recibidaPor: PersonaConsulta | null;
  emergenciaPrincipal: { id: string; numeroEmergencia: string } | null;
  duplicadas: { id: string; numeroEmergencia: string; recibidaEn: Date }[];
}

export interface TripulanteIngreso {
  usuarioId: string;
  nombreCompleto: string;
  /** conductor, paramedico, medico */
  funcion: string;
}

export interface EventoServicio {
  estadoAnterior: string | null;
  estadoNuevo: string;
  ocurridoEn: Date;
  usuario: PersonaConsulta | null;
  rolResponsable: string | null;
  latitud: number | null;
  longitud: number | null;
  distanciaEscenaMetros: number | null;
  fueraDeRadio: boolean;
  observacion: string | null;
}

export interface PuntoRecorrido {
  latitud: number;
  longitud: number;
  velocidad: number | null;
  registradaEn: Date;
}

export interface MovimientoInsumosIngreso {
  id: string;
  codigo: string;
  tipo: string;
  estado: string;
  realizadoEn: Date;
  registradoPor: PersonaConsulta;
  items: {
    insumoId: string;
    codigo: string;
    nombre: string;
    unidadMedida: string;
    cantidad: number;
    numeroLote: string | null;
    numeroSerie: string | null;
  }[];
}

/** Duraciones en segundos; `null` si falta alguna de las dos marcas. */
export interface TiemposServicio {
  /** Recepción de la llamada → asignación de la ambulancia. */
  despachoSegundos: number | null;
  /** Asignación → salida de la ambulancia. */
  alistamientoSegundos: number | null;
  /** Asignación → llegada a la escena (tiempo de respuesta). */
  respuestaSegundos: number | null;
  /** Llegada → salida de la escena. */
  enEscenaSegundos: number | null;
  /** Salida de la escena → llegada al destino. */
  trasladoSegundos: number | null;
  /** Asignación → finalización. */
  totalSegundos: number | null;
}

export interface MarcasServicio {
  recibidaEn: Date;
  asignadaEn: Date;
  salidaEn: Date | null;
  llegadaEscenaEn: Date | null;
  salidaEscenaEn: Date | null;
  llegadaDestinoEn: Date | null;
  finalizadaEn: Date | null;
}

export function calcularTiemposServicio(m: MarcasServicio): TiemposServicio {
  const entre = (a: Date | null, b: Date | null) =>
    a && b && b >= a ? Math.round((b.getTime() - a.getTime()) / 1000) : null;
  return {
    despachoSegundos: entre(m.recibidaEn, m.asignadaEn),
    alistamientoSegundos: entre(m.asignadaEn, m.salidaEn),
    respuestaSegundos: entre(m.asignadaEn, m.llegadaEscenaEn),
    enEscenaSegundos: entre(m.llegadaEscenaEn, m.salidaEscenaEn),
    trasladoSegundos: entre(m.salidaEscenaEn, m.llegadaDestinoEn),
    totalSegundos: entre(m.asignadaEn, m.finalizadaEn),
  };
}

export interface AsignacionIngreso extends Omit<MarcasServicio, 'recibidaEn'> {
  id: string;
  estado: string;
  ambulancia: {
    id: string;
    codigo: string;
    placa: string;
    tipo: string;
  };
  tripulacion: TripulanteIngreso[];
  asignadaPor: PersonaConsulta | null;
  atencionInicioEn: Date | null;
  motivoCancelacion: string | null;
  institucionDestino: {
    id: string;
    nombre: string;
    direccion: string | null;
  } | null;
  tiempos: TiemposServicio;
  eventos: EventoServicio[];
  recorrido: {
    puntos: PuntoRecorrido[];
    totalPuntos: number;
    /** true si se enviaron menos puntos que los registrados (muestreo uniforme). */
    muestreado: boolean;
  };
  insumos: MovimientoInsumosIngreso[];
}

export interface IngresoServicio {
  emergencia: EmergenciaIngreso;
  asignaciones: AsignacionIngreso[];
  historias: ResumenHistoriaConsulta[];
}

/** Máximo de puntos del recorrido que se envían al mapa. */
export const PUNTOS_MAXIMOS_RECORRIDO = 1500;

/** Toma puntos repartidos de forma uniforme, siempre con el primero y el último. */
export function muestrearRecorrido<T>(
  puntos: readonly T[],
  maximo: number,
): T[] {
  if (puntos.length <= maximo) return [...puntos];
  const paso = (puntos.length - 1) / (maximo - 1);
  return Array.from(
    { length: maximo },
    (_, i) => puntos[Math.round(i * paso)] as T,
  );
}

export const PATRON_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Trazabilidad
// ---------------------------------------------------------------------------

/** Qué significa cada acción que la auditoría guarda sobre una historia. */
export const DESCRIPCIONES_ACCION_HISTORIA: Readonly<Record<string, string>> = {
  abrir: 'Abrió la historia',
  actualizar: 'Actualizó datos de la historia',
  registrar_signo_vital: 'Registró una toma de signos vitales',
  registrar_lesion: 'Registró una lesión',
  registrar_intervencion: 'Registró un procedimiento o medicamento',
  registrar_valoracion_downton: 'Registró una valoración de riesgo de caídas',
  eliminar_signo_vital: 'Quitó una toma de signos vitales',
  eliminar_lesion: 'Quitó una lesión',
  eliminar_intervencion: 'Quitó un procedimiento o medicamento',
  eliminar_valoracion_downton: 'Quitó una valoración de riesgo de caídas',
  firma_rechazada: 'Intento de firma rechazado (contraseña incorrecta)',
  cerrar: 'Firmó y cerró la historia',
  anular: 'Anuló la historia',
  consultar: 'Consultó la historia',
  consultar_valoraciones_downton:
    'Consultó las valoraciones de riesgo de caídas',
  consultar_valoracion_downton: 'Consultó una valoración de riesgo de caídas',
  consultar_firma_cierre: 'Consultó la firma del cierre',
  consultar_trazabilidad: 'Consultó la trazabilidad',
  registrar_firma_paciente:
    'Tomó la firma del paciente (o registró por qué no firmó)',
  registrar_firma_acudiente: 'Tomó la firma de un familiar',
  registrar_firma_testigo: 'Tomó la firma de un testigo',
  registrar_firma_receptor: 'Tomó la firma de quien recibe al paciente',
  eliminar_firma_paciente: 'Quitó la firma del paciente',
  eliminar_firma_acudiente: 'Quitó la firma del familiar',
  eliminar_firma_testigo: 'Quitó la firma del testigo',
  eliminar_firma_receptor: 'Quitó la firma de quien recibe',
  consultar_firma_historia: 'Consultó una firma de la historia',
};

/** Qué tipo de acción es, para agrupar y dar color en la pantalla. */
export type TipoAccionHistoria =
  'creacion' | 'modificacion' | 'firma' | 'anulacion' | 'consulta';

export function tipoDeAccion(accion: string): TipoAccionHistoria {
  if (accion === 'abrir') return 'creacion';
  if (
    accion === 'cerrar' ||
    accion === 'firma_rechazada' ||
    accion.startsWith('registrar_firma_')
  ) {
    return 'firma';
  }
  if (accion === 'anular') return 'anulacion';
  if (accion.startsWith('consultar')) return 'consulta';
  return 'modificacion';
}

/** Solo estas claves del detalle de la auditoría se muestran: ninguna lleva valores clínicos. */
export const CLAVES_DETALLE_TRAZABILIDAD = [
  'campos',
  'registroId',
  'numeroHistoria',
  'asignacionId',
  'hashCierre',
  'metodoFirma',
  'versionDeclaracion',
  'firmaCierreId',
  'firmaId',
  'motivo',
  'proposito',
  'conImagen',
] as const;

export interface EventoTrazabilidad {
  id: string;
  accion: string;
  descripcion: string;
  tipo: TipoAccionHistoria;
  ocurridoEn: Date;
  usuario: (PersonaConsulta & { rol: string | null }) | null;
  direccionIp: string | null;
  detalle: Record<string, unknown>;
}
