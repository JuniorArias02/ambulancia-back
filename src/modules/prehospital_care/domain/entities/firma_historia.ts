import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type { DatosHistoria } from './historia_clinica.entity.js';

/**
 * Firmas de quienes no son usuarios del sistema, tomadas en el celular:
 * paciente, acudiente (familiar mayor de edad), testigo y receptor en la
 * institución. La del profesional que cierra es `firmaCierre` de la historia.
 */

export const ROLES_FIRMANTE = [
  'paciente',
  'acudiente',
  'testigo',
  'receptor',
] as const;
export type RolFirmante = (typeof ROLES_FIRMANTE)[number];

export const PROPOSITOS_FIRMA = [
  'comprobante_atencion',
  'disentimiento',
  'entrega',
] as const;
export type PropositoFirma = (typeof PROPOSITOS_FIRMA)[number];

/** Qué puede firmar cada rol. */
export const PROPOSITOS_POR_ROL: Readonly<
  Record<RolFirmante, readonly PropositoFirma[]>
> = {
  paciente: ['comprobante_atencion', 'disentimiento'],
  acudiente: ['comprobante_atencion', 'disentimiento'],
  testigo: ['disentimiento'],
  receptor: ['entrega'],
};

/** Por qué no firmó nadie (solo en filas del paciente, sin imagen). */
export const MOTIVOS_SIN_FIRMA = [
  'inconsciente_sin_acudiente',
  'fallecido',
  'se_nego',
  'otro',
] as const;
export type MotivoSinFirma = (typeof MOTIVOS_SIN_FIRMA)[number];

/** El acudiente debe ser un familiar (decisión 2026-11-14). */
export const PARENTESCOS = [
  'padre',
  'madre',
  'hijo',
  'conyuge_companero',
  'hermano',
  'abuelo',
  'nieto',
  'tio',
  'sobrino',
  'primo',
  'otro_familiar',
] as const;
export type Parentesco = (typeof PARENTESCOS)[number];

/** Documentos de un mayor de edad: sin TI ni registro civil (acudiente y testigo). */
export const DOCUMENTOS_ADULTO = ['CC', 'CE', 'PA', 'PEP', 'PPT'] as const;
export type DocumentoAdulto = (typeof DOCUMENTOS_ADULTO)[number];

/** Lo que acepta quien firma. Si un texto cambia, se sube la versión. */
export const TEXTOS_FIRMA: Readonly<
  Record<PropositoFirma, { version: string; texto: string }>
> = {
  comprobante_atencion: {
    version: 'v1',
    texto:
      'Declaro que recibí la atención prehospitalaria y, si aplica, el traslado descritos en esta historia clínica.',
  },
  disentimiento: {
    version: 'v1',
    texto:
      'Declaro que se me explicaron con claridad mi estado de salud y los riesgos de no ser trasladado a una institución de salud, y que rechazo el traslado de forma libre y voluntaria, asumiendo sus consecuencias.',
  },
  entrega: {
    version: 'v1',
    texto:
      'Declaro que recibí al paciente en esta institución en la condición descrita en la historia clínica.',
  },
};

export interface ImagenFirmaHistoria {
  claveAlmacenamiento: string;
  tipoMime: 'image/png';
  tamanoBytes: number;
  anchoPx: number;
  altoPx: number;
  huellaSha256: string;
}

export interface FirmaHistoria {
  id: string;
  historiaClinicaId: string;
  rolFirmante: RolFirmante;
  proposito: PropositoFirma;
  nombreFirmante: string | null;
  tipoDocumento: string | null;
  numeroDocumento: string | null;
  parentesco: Parentesco | null;
  cargo: string | null;
  imagen: ImagenFirmaHistoria | null;
  motivoSinFirma: MotivoSinFirma | null;
  detalleMotivo: string | null;
  textoVersion: string;
  firmadaEn: Date;
  registradaPorId: string;
  registradaPorNombre: string | null;
}

/** Lo que llega del celular. La imagen ya validada y guardada, si la hay. */
export interface DatosNuevaFirmaHistoria {
  id: string;
  historiaClinicaId: string;
  rolFirmante: RolFirmante;
  proposito: PropositoFirma;
  nombreFirmante?: string;
  tipoDocumento?: string;
  numeroDocumento?: string;
  parentesco?: Parentesco;
  cargo?: string;
  imagen: ImagenFirmaHistoria | null;
  motivoSinFirma?: MotivoSinFirma;
  detalleMotivo?: string;
  firmadaEn: Date;
  registradaPorId: string;
  ahora: Date;
}

const TOLERANCIA_FUTURO_MS = 60_000;

/** Sin espacios, puntos ni guiones, en mayúsculas: igual que el documento de la historia. */
function normalizarDocumento(documento: string): string {
  return documento.replace(/[\s.-]/g, '').toUpperCase();
}

function texto(valor: string | undefined): string | null {
  return valor?.trim() || null;
}

/**
 * Valida las reglas de cada firmante con los datos actuales de la historia.
 * Lo que depende de otras firmas (el testigo cuando el paciente se niega) se
 * revisa al cerrar.
 */
export function crearFirmaHistoria(
  datos: DatosNuevaFirmaHistoria,
  historia: Readonly<DatosHistoria>,
): FirmaHistoria {
  const { rolFirmante: rol, proposito } = datos;
  if (!PROPOSITOS_POR_ROL[rol].includes(proposito)) {
    throw new ReglaNegocioError(`El ${rol} no firma el ${proposito}`);
  }
  if (
    datos.firmadaEn.getTime() >
    datos.ahora.getTime() + TOLERANCIA_FUTURO_MS
  ) {
    throw new ReglaNegocioError('La fecha de la firma está en el futuro');
  }
  if (
    proposito === 'disentimiento' &&
    (historia.desenlace !== 'rechazo_traslado' || !historia.motivoRechazo)
  ) {
    throw new ReglaNegocioError(
      'El disentimiento se firma cuando el desenlace es "rechazo del traslado" y ya está el motivo del rechazo',
    );
  }

  // O imagen o motivo; el motivo solo en la fila del paciente.
  const motivo = datos.motivoSinFirma ?? null;
  if ((datos.imagen === null) === (motivo === null)) {
    throw new ReglaNegocioError(
      'Envíe la imagen de la firma o el motivo por el que nadie pudo firmar, no ambos',
    );
  }
  if (motivo && rol !== 'paciente') {
    throw new ReglaNegocioError(
      'El motivo sin firma se registra en la firma del paciente',
    );
  }
  const detalleMotivo = texto(datos.detalleMotivo);
  if (motivo === 'otro' && !detalleMotivo) {
    throw new ReglaNegocioError('Describa el motivo');
  }

  const base = {
    id: datos.id,
    historiaClinicaId: datos.historiaClinicaId,
    rolFirmante: rol,
    proposito,
    imagen: datos.imagen,
    motivoSinFirma: motivo,
    detalleMotivo: motivo ? detalleMotivo : null,
    textoVersion: TEXTOS_FIRMA[proposito].version,
    firmadaEn: datos.firmadaEn,
    registradaPorId: datos.registradaPorId,
    registradaPorNombre: null,
    parentesco: null,
    cargo: null,
  };

  switch (rol) {
    case 'paciente': {
      // El paciente firma con los datos de la historia, que deben estar completos.
      const nombre = [historia.nombres, historia.apellidos]
        .filter(Boolean)
        .join(' ');
      if (datos.imagen && (!historia.nombres || !historia.numeroDocumento)) {
        throw new ReglaNegocioError(
          'Para que firme el paciente, complete antes sus nombres y su documento en la historia; si no es posible, que firme un familiar',
        );
      }
      return {
        ...base,
        nombreFirmante: nombre || null,
        tipoDocumento: historia.tipoDocumento,
        numeroDocumento: historia.numeroDocumento,
      };
    }
    case 'acudiente':
    case 'testigo': {
      const nombre = texto(datos.nombreFirmante);
      const documento = texto(datos.numeroDocumento);
      if (!nombre || nombre.length < 5 || !documento) {
        throw new ReglaNegocioError(
          `Indique el nombre completo y el documento del ${rol}`,
        );
      }
      if (!DOCUMENTOS_ADULTO.some((tipo) => tipo === datos.tipoDocumento)) {
        throw new ReglaNegocioError(
          `El ${rol} debe ser mayor de edad: documento ${DOCUMENTOS_ADULTO.join(', ')}`,
        );
      }
      if (rol === 'acudiente' && !datos.parentesco) {
        throw new ReglaNegocioError(
          'Indique el parentesco: el acudiente debe ser un familiar',
        );
      }
      return {
        ...base,
        nombreFirmante: nombre,
        tipoDocumento: datos.tipoDocumento ?? null,
        numeroDocumento: normalizarDocumento(documento),
        parentesco: rol === 'acudiente' ? (datos.parentesco ?? null) : null,
      };
    }
    case 'receptor': {
      const nombre = texto(datos.nombreFirmante);
      const cargo = texto(datos.cargo);
      if (!nombre || !cargo) {
        throw new ReglaNegocioError(
          'Indique el nombre y el cargo de quien recibe al paciente',
        );
      }
      const documento = texto(datos.numeroDocumento);
      return {
        ...base,
        nombreFirmante: nombre,
        tipoDocumento: documento ? (datos.tipoDocumento ?? null) : null,
        numeroDocumento: documento ? normalizarDocumento(documento) : null,
        cargo,
      };
    }
  }
}

/** Lo que se necesita de cada firma para revisar el cierre. */
export interface ResumenFirmaHistoria {
  rolFirmante: RolFirmante;
  proposito: PropositoFirma;
  conImagen: boolean;
  motivoSinFirma: MotivoSinFirma | null;
}

export function resumirFirma(firma: FirmaHistoria): ResumenFirmaHistoria {
  return {
    rolFirmante: firma.rolFirmante,
    proposito: firma.proposito,
    conImagen: firma.imagen !== null,
    motivoSinFirma: firma.motivoSinFirma,
  };
}
