import {
  ConflictoNegocioError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import {
  identificarUnidad,
  type ReferenciaUnidad,
  type UnidadIdentificada,
} from '../services/identificacion_unidad.js';
import {
  cantidadNoNegativa,
  textoObligatorio,
  textoOpcional,
} from '../services/validaciones.js';

export const TIPOS_VERIFICACION = [
  'inicio_turno',
  'fin_turno',
  'extraordinaria',
] as const;
export type TipoVerificacion = (typeof TIPOS_VERIFICACION)[number];

export const ESTADOS_VERIFICACION = [
  'borrador',
  'completada',
  'con_novedades',
] as const;
export type EstadoVerificacion = (typeof ESTADOS_VERIFICACION)[number];

export const ESTADOS_CONTEO = [
  'conforme',
  'faltante',
  'sobrante',
  'vencido',
  'danado',
] as const;
export type EstadoConteo = (typeof ESTADOS_CONTEO)[number];

export const MAXIMO_CONTEOS = 500;

export const LONGITUD_MAXIMA_RESOLUCION = 2000;

/** Quién atendió las novedades, cuándo y cómo. */
export interface RevisionVerificacion {
  /** `null` solo si el usuario se eliminara (la FK lo deja en NULL). */
  revisadaPorId: string | null;
  revisadaEn: Date;
  resolucion: string;
  /** Solo lectura. */
  revisadaPorNombre: string | null;
}

export interface Conteo extends UnidadIdentificada {
  id: string;
  perfilDetalleId: string | null;
  /** Lo que dice el sistema en esa ubicación cuando se contó. */
  cantidadEsperada: number;
  cantidadEncontrada: number;
  estado: EstadoConteo;
  observaciones: string | null;
  creadoEn: Date;
  /** Solo lectura. */
  insumoNombre: string;
  numeroLote: string | null;
  numeroSerie: string | null;
}

export interface DatosConteo extends ReferenciaUnidad {
  cantidadEncontrada: number;
  /** Si no se indica, sale de comparar lo encontrado con lo esperado. */
  estado: EstadoConteo | null;
  observaciones: string | null;
}

/** Lo que aporta el servidor a cada conteo: nunca lo envía el celular. */
export interface ReferenciaConteo {
  cantidadEsperada: number;
  perfilDetalleId: string | null;
  hoy: string;
}

export interface PropiedadesVerificacion {
  id: string;
  ubicacionId: string;
  turnoId: string | null;
  responsableId: string;
  tipo: TipoVerificacion;
  estado: EstadoVerificacion;
  iniciadaEn: Date;
  finalizadaEn: Date | null;
  observaciones: string | null;
  conteos: Conteo[];
  /** `null` mientras la central no haya atendido sus novedades. */
  revision: RevisionVerificacion | null;
  /** Solo lectura. */
  ubicacionNombre: string | null;
  responsableNombre: string | null;
}

/**
 * Conteo físico del inventario de una ubicación contra lo que dice el sistema.
 * No cambia existencias: las novedades las resuelve la bodega con un ajuste,
 * una baja o una reposición.
 */
export class Verificacion {
  private constructor(private readonly propiedades: PropiedadesVerificacion) {}

  static iniciar(
    datos: {
      ubicacionId: string;
      turnoId: string | null;
      responsableId: string;
      tipo: TipoVerificacion;
      observaciones: string | null;
    },
    ahora: Date,
  ): Verificacion {
    return new Verificacion({
      id: crypto.randomUUID(),
      ubicacionId: datos.ubicacionId,
      turnoId: datos.turnoId,
      responsableId: datos.responsableId,
      tipo: datos.tipo,
      estado: 'borrador',
      iniciadaEn: ahora,
      finalizadaEn: null,
      observaciones: textoOpcional(
        datos.observaciones,
        'Las observaciones',
        5000,
      ),
      conteos: [],
      revision: null,
      ubicacionNombre: null,
      responsableNombre: null,
    });
  }

  static reconstruir(propiedades: PropiedadesVerificacion): Verificacion {
    return new Verificacion({
      ...propiedades,
      conteos: propiedades.conteos.map((c) => ({ ...c })),
      revision: propiedades.revision ? { ...propiedades.revision } : null,
    });
  }

  get id(): string {
    return this.propiedades.id;
  }
  get ubicacionId(): string {
    return this.propiedades.ubicacionId;
  }
  get ubicacionNombre(): string | null {
    return this.propiedades.ubicacionNombre;
  }
  get turnoId(): string | null {
    return this.propiedades.turnoId;
  }
  get responsableId(): string {
    return this.propiedades.responsableId;
  }
  get responsableNombre(): string | null {
    return this.propiedades.responsableNombre;
  }
  get tipo(): TipoVerificacion {
    return this.propiedades.tipo;
  }
  get estado(): EstadoVerificacion {
    return this.propiedades.estado;
  }
  get iniciadaEn(): Date {
    return this.propiedades.iniciadaEn;
  }
  get finalizadaEn(): Date | null {
    return this.propiedades.finalizadaEn;
  }
  get observaciones(): string | null {
    return this.propiedades.observaciones;
  }
  get conteos(): readonly Conteo[] {
    return this.propiedades.conteos;
  }

  get revision(): RevisionVerificacion | null {
    return this.propiedades.revision;
  }

  /** Tiene novedades que la central todavía no ha atendido. */
  estaPendienteDeRevision(): boolean {
    return (
      this.propiedades.estado === 'con_novedades' &&
      this.propiedades.revision === null
    );
  }

  /**
   * La central deja constancia de cómo atendió las novedades (por ejemplo, el
   * código del ajuste o de la transferencia). Se revisa una sola vez y no
   * cambia existencias: la corrección se hace con sus propios movimientos.
   */
  revisar(revisadaPorId: string, resolucion: string, ahora: Date): void {
    if (this.propiedades.estado !== 'con_novedades') {
      throw new ReglaNegocioError(
        'Solo se revisa una verificación finalizada con novedades',
      );
    }
    if (this.propiedades.revision) {
      throw new ConflictoNegocioError('La verificación ya fue revisada');
    }
    this.propiedades.revision = {
      revisadaPorId,
      revisadaEn: ahora,
      resolucion: textoObligatorio(
        resolucion,
        'La resolución',
        LONGITUD_MAXIMA_RESOLUCION,
      ),
      revisadaPorNombre: null,
    };
  }

  estaEnBorrador(): boolean {
    return this.propiedades.estado === 'borrador';
  }

  /** Registra (o reemplaza) el conteo de una unidad. */
  registrarConteo(
    datos: DatosConteo,
    referencia: ReferenciaConteo,
    ahora: Date,
  ): Conteo {
    this.exigirBorrador();
    const unidad = identificarUnidad(datos);
    const nombre = datos.insumo.nombre;
    const cantidadEncontrada = cantidadNoNegativa(
      datos.cantidadEncontrada,
      `La cantidad encontrada de "${nombre}"`,
    );
    if (datos.equipo && cantidadEncontrada > 1) {
      throw new ReglaNegocioError(`Un equipo se cuenta como 0 o 1`);
    }
    const loteVencido = datos.lote?.estaVencido(referencia.hoy) ?? false;
    const observaciones = textoOpcional(
      datos.observaciones,
      'Las observaciones',
      5000,
    );
    const estado = Verificacion.estadoDelConteo({
      esperada: referencia.cantidadEsperada,
      encontrada: cantidadEncontrada,
      indicado: datos.estado,
      loteVencido,
      observaciones,
      nombre,
    });

    const anterior = this.propiedades.conteos.find(
      (c) => c.claveControl === unidad.claveControl,
    );
    if (!anterior && this.propiedades.conteos.length >= MAXIMO_CONTEOS) {
      throw new ReglaNegocioError(
        `Una verificación admite máximo ${MAXIMO_CONTEOS} conteos`,
      );
    }
    const conteo: Conteo = {
      ...unidad,
      id: anterior?.id ?? crypto.randomUUID(),
      perfilDetalleId: referencia.perfilDetalleId,
      cantidadEsperada: referencia.cantidadEsperada,
      cantidadEncontrada,
      estado,
      observaciones,
      creadoEn: ahora,
      insumoNombre: nombre,
      numeroLote: datos.lote?.numeroLote ?? null,
      numeroSerie: datos.equipo?.numeroSerie ?? null,
    };
    this.propiedades.conteos = [
      ...this.propiedades.conteos.filter(
        (c) => c.claveControl !== unidad.claveControl,
      ),
      conteo,
    ];
    return conteo;
  }

  /** Claves de las existencias que todavía no se han contado. */
  sinContar(clavesConExistencia: readonly string[]): string[] {
    const contadas = new Set(
      this.propiedades.conteos.map((c) => c.claveControl),
    );
    return clavesConExistencia.filter((clave) => !contadas.has(clave));
  }

  /**
   * La de inicio o fin de turno exige contar todo lo que hay; la extraordinaria
   * puede reportar solo una novedad.
   */
  finalizar(
    pendientes: readonly string[],
    observaciones: string | null,
    ahora: Date,
  ): void {
    this.exigirBorrador();
    if (this.propiedades.conteos.length === 0) {
      throw new ReglaNegocioError(
        'Registre al menos un conteo antes de finalizar',
      );
    }
    if (this.propiedades.tipo !== 'extraordinaria' && pendientes.length > 0) {
      throw new ReglaNegocioError(
        `Faltan por contar: ${pendientes.join(' · ')}`,
      );
    }
    const conNovedades = this.propiedades.conteos.some(
      (c) => c.estado !== 'conforme',
    );
    this.propiedades.estado = conNovedades ? 'con_novedades' : 'completada';
    this.propiedades.finalizadaEn = ahora;
    const nota = textoOpcional(observaciones, 'Las observaciones', 5000);
    if (nota) this.propiedades.observaciones = nota;
  }

  private exigirBorrador(): void {
    if (!this.estaEnBorrador()) {
      throw new ReglaNegocioError('La verificación ya fue finalizada');
    }
  }

  private static estadoDelConteo(datos: {
    esperada: number;
    encontrada: number;
    indicado: EstadoConteo | null;
    loteVencido: boolean;
    observaciones: string | null;
    nombre: string;
  }): EstadoConteo {
    const {
      esperada,
      encontrada,
      indicado,
      loteVencido,
      observaciones,
      nombre,
    } = datos;
    const porCantidad: EstadoConteo =
      encontrada === esperada
        ? 'conforme'
        : encontrada < esperada
          ? 'faltante'
          : 'sobrante';

    if (indicado === null) {
      return loteVencido && encontrada > 0 ? 'vencido' : porCantidad;
    }
    switch (indicado) {
      case 'conforme':
      case 'faltante':
      case 'sobrante':
        if (indicado !== porCantidad) {
          throw new ReglaNegocioError(
            `"${nombre}": se esperaban ${esperada} y se encontraron ${encontrada}; no es "${indicado}"`,
          );
        }
        if (indicado === 'conforme' && loteVencido && encontrada > 0) {
          throw new ReglaNegocioError(
            `"${nombre}" está vencido: márquelo como vencido`,
          );
        }
        return indicado;
      case 'vencido':
        if (!loteVencido && !observaciones) {
          throw new ReglaNegocioError(
            `Explique por qué "${nombre}" está vencido`,
          );
        }
        return indicado;
      case 'danado':
        if (!observaciones) {
          throw new ReglaNegocioError(`Describa el daño de "${nombre}"`);
        }
        return indicado;
    }
  }
}
