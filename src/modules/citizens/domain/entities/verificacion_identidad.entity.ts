import {
  AccesoDenegadoError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';

export const ESTADOS_VERIFICACION = [
  'pendiente',
  'en_revision',
  'verificado',
  'rechazado',
  'requiere_correccion',
] as const;
export type EstadoVerificacion = (typeof ESTADOS_VERIFICACION)[number];

/** Lo que puede decidir el administrador; `pendiente` solo lo produce el ciudadano al enviar. */
export const DECISIONES_VERIFICACION = [
  'en_revision',
  'verificado',
  'rechazado',
  'requiere_correccion',
] as const;
export type DecisionVerificacion = (typeof DECISIONES_VERIFICACION)[number];

export const LADOS_DOCUMENTO = ['frontal', 'posterior'] as const;
export type LadoDocumento = (typeof LADOS_DOCUMENTO)[number];

/** La foto vive en el almacenamiento privado; aquí solo su referencia. */
export interface DocumentoIdentidad {
  id: string;
  lado: LadoDocumento;
  claveAlmacenamiento: string;
  tipoMime: string;
  tamanoBytes: number;
  huellaSha256: string;
  cargadoEn: Date;
}

/** Una fila del historial: decisión del administrador o envío del ciudadano. */
export interface CambioVerificacion {
  estadoAnterior: EstadoVerificacion | null;
  estadoNuevo: EstadoVerificacion;
  /** Lo que verá el ciudadano. */
  motivo: string | null;
  /** Notas internas del administrador; el ciudadano nunca las ve. */
  observaciones: string | null;
  responsableId: string;
  ocurridoEn: Date;
}

/**
 * `verificado` y `rechazado` son finales: un rechazo no se reabre en esta
 * versión. Solo `requiere_correccion` vuelve a `pendiente`, cuando el
 * ciudadano reenvía.
 */
const TRANSICIONES: Record<
  EstadoVerificacion,
  readonly DecisionVerificacion[]
> = {
  pendiente: ['en_revision', 'verificado', 'rechazado', 'requiere_correccion'],
  en_revision: ['verificado', 'rechazado', 'requiere_correccion'],
  verificado: [],
  rechazado: [],
  requiere_correccion: [],
};

const DECISIONES_CON_MOTIVO: readonly DecisionVerificacion[] = [
  'rechazado',
  'requiere_correccion',
];

export const LONGITUD_MAXIMA_MOTIVO = 500;

export interface PropiedadesVerificacion {
  id: string;
  usuarioId: string;
  estado: EstadoVerificacion;
  motivo: string | null;
  enviadaEn: Date;
  revisadaPorId: string | null;
  revisadaEn: Date | null;
  /** Solo los vigentes. */
  documentos: DocumentoIdentidad[];
}

export class VerificacionIdentidad {
  private constructor(private readonly propiedades: PropiedadesVerificacion) {}

  /** El registro exige las dos caras del documento. */
  static iniciar(datos: {
    usuarioId: string;
    documentos: DocumentoIdentidad[];
    fecha: Date;
  }): { verificacion: VerificacionIdentidad; cambio: CambioVerificacion } {
    VerificacionIdentidad.exigirAmbosLados(datos.documentos);
    const verificacion = new VerificacionIdentidad({
      id: crypto.randomUUID(),
      usuarioId: datos.usuarioId,
      estado: 'pendiente',
      motivo: null,
      enviadaEn: datos.fecha,
      revisadaPorId: null,
      revisadaEn: null,
      documentos: [...datos.documentos],
    });
    return {
      verificacion,
      cambio: {
        estadoAnterior: null,
        estadoNuevo: 'pendiente',
        motivo: null,
        observaciones: null,
        responsableId: datos.usuarioId,
        ocurridoEn: datos.fecha,
      },
    };
  }

  static reconstruir(
    propiedades: PropiedadesVerificacion,
  ): VerificacionIdentidad {
    return new VerificacionIdentidad({
      ...propiedades,
      documentos: [...propiedades.documentos],
    });
  }

  private static exigirAmbosLados(documentos: DocumentoIdentidad[]): void {
    for (const lado of LADOS_DOCUMENTO) {
      if (documentos.filter((d) => d.lado === lado).length !== 1) {
        throw new ReglaNegocioError(
          `Falta la foto ${lado} del documento de identidad`,
        );
      }
    }
  }

  get id(): string {
    return this.propiedades.id;
  }
  get usuarioId(): string {
    return this.propiedades.usuarioId;
  }
  get estado(): EstadoVerificacion {
    return this.propiedades.estado;
  }
  get motivo(): string | null {
    return this.propiedades.motivo;
  }
  get enviadaEn(): Date {
    return this.propiedades.enviadaEn;
  }
  get revisadaPorId(): string | null {
    return this.propiedades.revisadaPorId;
  }
  get revisadaEn(): Date | null {
    return this.propiedades.revisadaEn;
  }
  get documentos(): readonly DocumentoIdentidad[] {
    return this.propiedades.documentos;
  }

  /** Única condición para reportar emergencias; sin excepciones en esta versión. */
  permiteReportar(): boolean {
    return this.propiedades.estado === 'verificado';
  }

  permiteReenviar(): boolean {
    return this.propiedades.estado === 'requiere_correccion';
  }

  decidir(datos: {
    decision: DecisionVerificacion;
    motivo?: string | null;
    observaciones?: string | null;
    revisorId: string;
    fecha: Date;
  }): CambioVerificacion {
    if (datos.revisorId === this.propiedades.usuarioId) {
      throw new AccesoDenegadoError(
        'Nadie puede revisar su propia verificación',
      );
    }
    const anterior = this.propiedades.estado;
    if (!TRANSICIONES[anterior].includes(datos.decision)) {
      throw new ReglaNegocioError(
        `No se puede pasar una verificación de ${anterior} a ${datos.decision}`,
      );
    }
    const motivo = datos.motivo?.trim() || null;
    if (DECISIONES_CON_MOTIVO.includes(datos.decision) && !motivo) {
      throw new ReglaNegocioError(
        'Indique el motivo: el ciudadano necesita saber qué corregir o por qué se rechazó',
      );
    }

    const p = this.propiedades;
    p.estado = datos.decision;
    p.motivo = DECISIONES_CON_MOTIVO.includes(datos.decision) ? motivo : null;
    p.revisadaPorId = datos.revisorId;
    p.revisadaEn = datos.fecha;
    return {
      estadoAnterior: anterior,
      estadoNuevo: datos.decision,
      motivo,
      observaciones: datos.observaciones?.trim() || null,
      responsableId: datos.revisorId,
      ocurridoEn: datos.fecha,
    };
  }

  /**
   * El ciudadano corrige lo que le pidieron y vuelve a la fila de revisión.
   * Las fotos nuevas reemplazan a las del mismo lado.
   */
  reenviar(datos: { documentosNuevos: DocumentoIdentidad[]; fecha: Date }): {
    cambio: CambioVerificacion;
    reemplazados: DocumentoIdentidad[];
  } {
    if (!this.permiteReenviar()) {
      throw new ReglaNegocioError(
        `Solo se reenvía cuando se pidió una corrección; la verificación está ${this.propiedades.estado}`,
      );
    }
    const lados = datos.documentosNuevos.map((d) => d.lado);
    if (new Set(lados).size !== lados.length) {
      throw new ReglaNegocioError('Envíe una sola foto por cada lado');
    }

    const p = this.propiedades;
    const reemplazados = p.documentos.filter((d) => lados.includes(d.lado));
    p.documentos = [
      ...p.documentos.filter((d) => !lados.includes(d.lado)),
      ...datos.documentosNuevos,
    ];
    const anterior = p.estado;
    p.estado = 'pendiente';
    p.motivo = null;
    p.enviadaEn = datos.fecha;
    return {
      reemplazados,
      cambio: {
        estadoAnterior: anterior,
        estadoNuevo: 'pendiente',
        motivo: null,
        observaciones: null,
        responsableId: p.usuarioId,
        ocurridoEn: datos.fecha,
      },
    };
  }
}
