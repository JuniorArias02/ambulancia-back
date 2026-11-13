import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import {
  diaColombia,
  fechaColombia,
} from '../../../../common/utils/fecha_colombia.js';
import {
  identificarUnidad,
  type ReferenciaUnidad,
  type UnidadIdentificada,
} from '../services/identificacion_unidad.js';
import {
  cantidadPositiva,
  noEnElFuturo,
  textoOpcional,
} from '../services/validaciones.js';
import type { EstadoEquipo } from './equipo.entity.js';
import type {
  TipoUbicacion,
  UbicacionInventario,
} from './ubicacion_inventario.entity.js';

export const TIPOS_MOVIMIENTO = [
  'entrada',
  'transferencia',
  'consumo',
  'devolucion',
  'ajuste',
  'baja',
] as const;
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

export const ESTADOS_MOVIMIENTO = [
  'borrador',
  'confirmado',
  'anulado',
] as const;
export type EstadoMovimiento = (typeof ESTADOS_MOVIMIENTO)[number];

export const MAXIMO_LINEAS_MOVIMIENTO = 200;

type Presencia = 'requerida' | 'prohibida' | 'opcional';

interface ReglaTipo {
  origen: Presencia;
  destino: Presencia;
  tipoOrigen?: TipoUbicacion;
  tipoDestino?: TipoUbicacion;
  exigeMotivo: boolean;
}

/**
 * Qué ubicaciones usa cada tipo. El origen siempre resta y el destino siempre
 * suma: un ajuste lleva solo destino si aumenta y solo origen si disminuye.
 */
const REGLAS_TIPO: Record<TipoMovimiento, ReglaTipo> = {
  entrada: {
    origen: 'prohibida',
    destino: 'requerida',
    tipoDestino: 'bodega',
    exigeMotivo: false,
  },
  transferencia: {
    origen: 'requerida',
    destino: 'requerida',
    exigeMotivo: false,
  },
  consumo: {
    origen: 'requerida',
    destino: 'prohibida',
    tipoOrigen: 'ambulancia',
    exigeMotivo: false,
  },
  devolucion: {
    origen: 'requerida',
    destino: 'requerida',
    tipoOrigen: 'ambulancia',
    tipoDestino: 'bodega',
    exigeMotivo: false,
  },
  ajuste: { origen: 'opcional', destino: 'opcional', exigeMotivo: true },
  baja: { origen: 'requerida', destino: 'prohibida', exigeMotivo: true },
};

export interface UbicacionMovimiento {
  id: string;
  tipo: TipoUbicacion;
  nombre: string | null;
  activa: boolean;
}

export interface LineaMovimiento extends UnidadIdentificada {
  id: string;
  cantidad: number;
  observaciones: string | null;
  /** Solo lectura: lo que hace falta para mostrar y revalidar al confirmar. */
  insumoCodigo: string;
  insumoNombre: string;
  unidadMedida: string;
  numeroLote: string | null;
  loteVencimiento: string | null;
  numeroSerie: string | null;
  equipoEstado: EstadoEquipo | null;
}

export interface DatosLineaMovimiento extends ReferenciaUnidad {
  cantidad: number;
  observaciones: string | null;
}

export interface DatosMovimiento {
  tipo: TipoMovimiento;
  origen: UbicacionInventario | null;
  destino: UbicacionInventario | null;
  lineas: DatosLineaMovimiento[];
  usuarioId: string;
  asignacionId: string | null;
  motivo: string | null;
  observaciones: string | null;
  documentoReferencia: string | null;
  /** Cuándo ocurrió; si no se indica, ahora. */
  realizadoEn: Date | null;
}

export interface PropiedadesMovimiento {
  id: string;
  codigo: string;
  tipo: TipoMovimiento;
  estado: EstadoMovimiento;
  origen: UbicacionMovimiento | null;
  destino: UbicacionMovimiento | null;
  asignacionId: string | null;
  usuarioId: string;
  motivo: string | null;
  observaciones: string | null;
  documentoReferencia: string | null;
  realizadoEn: Date;
  creadoEn: Date;
  actualizadoEn: Date;
  lineas: LineaMovimiento[];
  /** Solo lectura. */
  usuarioNombre: string | null;
}

/** Cuánto cambia una existencia al confirmar. */
export interface EfectoExistencia extends UnidadIdentificada {
  ubicacionId: string;
  /** Negativo en el origen, positivo en el destino. */
  delta: number;
  /** Para los mensajes de error: "Gasa estéril (lote L-1)". */
  descripcion: string;
}

/**
 * Operación de inventario. Nace en borrador (o confirmada, si se registra de
 * una vez) y solo al confirmarse cambia las existencias. Nada se borra: un
 * borrador equivocado se anula.
 */
export class Movimiento {
  private constructor(private readonly propiedades: PropiedadesMovimiento) {}

  static crear(datos: DatosMovimiento, ahora: Date): Movimiento {
    const regla = REGLAS_TIPO[datos.tipo];
    const origen = Movimiento.ubicacion(
      datos.origen,
      regla.origen,
      regla.tipoOrigen,
      'origen',
    );
    const destino = Movimiento.ubicacion(
      datos.destino,
      regla.destino,
      regla.tipoDestino,
      'destino',
    );
    if (datos.tipo === 'ajuste' && (origen === null) === (destino === null)) {
      throw new ReglaNegocioError(
        'Un ajuste lleva solo destino (aumenta) o solo origen (disminuye)',
      );
    }
    if (origen && destino && origen.id === destino.id) {
      throw new ReglaNegocioError('El origen y el destino deben ser distintos');
    }

    const motivo = textoOpcional(datos.motivo, 'El motivo', 150);
    if (regla.exigeMotivo && !motivo) {
      throw new ReglaNegocioError(
        `Indique el motivo del movimiento de ${datos.tipo}`,
      );
    }
    if (datos.asignacionId && datos.tipo !== 'consumo') {
      throw new ReglaNegocioError('Solo un consumo se asocia a un servicio');
    }

    const movimiento = new Movimiento({
      id: crypto.randomUUID(),
      codigo: Movimiento.nuevoCodigo(ahora),
      tipo: datos.tipo,
      estado: 'borrador',
      origen,
      destino,
      asignacionId: datos.asignacionId,
      usuarioId: datos.usuarioId,
      motivo,
      observaciones: textoOpcional(
        datos.observaciones,
        'Las observaciones',
        5000,
      ),
      documentoReferencia: textoOpcional(
        datos.documentoReferencia,
        'El documento de referencia',
        150,
      ),
      realizadoEn: noEnElFuturo(
        datos.realizadoEn ?? ahora,
        ahora,
        'La fecha del movimiento',
      ),
      creadoEn: ahora,
      actualizadoEn: ahora,
      lineas: Movimiento.lineas(datos),
      usuarioNombre: null,
    });
    const hoy = fechaColombia(ahora);
    for (const linea of movimiento.lineas) movimiento.validarLinea(linea, hoy);
    return movimiento;
  }

  static reconstruir(propiedades: PropiedadesMovimiento): Movimiento {
    return new Movimiento({
      ...propiedades,
      lineas: propiedades.lineas.map((l) => ({ ...l })),
    });
  }

  get id(): string {
    return this.propiedades.id;
  }
  get codigo(): string {
    return this.propiedades.codigo;
  }
  get tipo(): TipoMovimiento {
    return this.propiedades.tipo;
  }
  get estado(): EstadoMovimiento {
    return this.propiedades.estado;
  }
  get origen(): UbicacionMovimiento | null {
    return this.propiedades.origen;
  }
  get destino(): UbicacionMovimiento | null {
    return this.propiedades.destino;
  }
  get asignacionId(): string | null {
    return this.propiedades.asignacionId;
  }
  get usuarioId(): string {
    return this.propiedades.usuarioId;
  }
  get usuarioNombre(): string | null {
    return this.propiedades.usuarioNombre;
  }
  get motivo(): string | null {
    return this.propiedades.motivo;
  }
  get observaciones(): string | null {
    return this.propiedades.observaciones;
  }
  get documentoReferencia(): string | null {
    return this.propiedades.documentoReferencia;
  }
  get realizadoEn(): Date {
    return this.propiedades.realizadoEn;
  }
  get creadoEn(): Date {
    return this.propiedades.creadoEn;
  }
  get actualizadoEn(): Date {
    return this.propiedades.actualizadoEn;
  }
  get lineas(): readonly LineaMovimiento[] {
    return this.propiedades.lineas;
  }

  /**
   * Revalida con los datos de hoy (un lote pudo vencer o un equipo dañarse
   * desde que se creó el borrador) y lo deja listo para aplicar.
   */
  confirmar(ahora: Date, hoy: string): void {
    this.exigirBorrador();
    for (const ubicacion of [
      this.propiedades.origen,
      this.propiedades.destino,
    ]) {
      if (ubicacion && !ubicacion.activa) {
        throw new ReglaNegocioError(
          `La ubicación ${ubicacion.nombre ?? ubicacion.id} está inactiva`,
        );
      }
    }
    for (const linea of this.propiedades.lineas) this.validarLinea(linea, hoy);
    this.propiedades.estado = 'confirmado';
    this.propiedades.actualizadoEn = ahora;
  }

  anular(ahora: Date): void {
    this.exigirBorrador();
    this.propiedades.estado = 'anulado';
    this.propiedades.actualizadoEn = ahora;
  }

  /** Lo que cambia en existencias, ordenado para bloquear siempre en el mismo orden. */
  efectos(): EfectoExistencia[] {
    const { origen, destino, lineas } = this.propiedades;
    const efectos: EfectoExistencia[] = [];
    for (const linea of lineas) {
      const base = {
        insumoId: linea.insumoId,
        loteId: linea.loteId,
        equipoId: linea.equipoId,
        claveControl: linea.claveControl,
        descripcion: Movimiento.describir(linea),
      };
      if (origen)
        efectos.push({
          ...base,
          ubicacionId: origen.id,
          delta: -linea.cantidad,
        });
      if (destino)
        efectos.push({
          ...base,
          ubicacionId: destino.id,
          delta: linea.cantidad,
        });
    }
    return efectos.sort((a, b) =>
      `${a.ubicacionId}|${a.claveControl}`.localeCompare(
        `${b.ubicacionId}|${b.claveControl}`,
      ),
    );
  }

  /** Movimientos que tocan esta ubicación (para el historial de la ambulancia). */
  involucraA(ubicacionId: string): boolean {
    return (
      this.propiedades.origen?.id === ubicacionId ||
      this.propiedades.destino?.id === ubicacionId
    );
  }

  static describir(linea: {
    insumoNombre: string;
    numeroLote: string | null;
    numeroSerie: string | null;
  }): string {
    if (linea.numeroSerie)
      return `${linea.insumoNombre} (serie ${linea.numeroSerie})`;
    if (linea.numeroLote)
      return `${linea.insumoNombre} (lote ${linea.numeroLote})`;
    return linea.insumoNombre;
  }

  private validarLinea(linea: LineaMovimiento, hoy: string): void {
    const { tipo, destino } = this.propiedades;
    const vaAAmbulancia = destino?.tipo === 'ambulancia';
    const descripcion = Movimiento.describir(linea);
    const vencido =
      linea.loteVencimiento !== null && linea.loteVencimiento < hoy;
    if (vencido && (vaAAmbulancia || tipo === 'consumo')) {
      throw new ReglaNegocioError(
        `${descripcion} está vencido: no puede ir a una ambulancia ni usarse`,
      );
    }
    if (linea.equipoEstado === 'baja') {
      throw new ReglaNegocioError(`${descripcion} está dado de baja`);
    }
    if (
      vaAAmbulancia &&
      linea.equipoEstado &&
      linea.equipoEstado !== 'operativo'
    ) {
      throw new ReglaNegocioError(
        `${descripcion} no está operativo: no puede ir a una ambulancia`,
      );
    }
  }

  private exigirBorrador(): void {
    if (this.propiedades.estado !== 'borrador') {
      throw new ReglaNegocioError(
        `El movimiento ${this.propiedades.codigo} ya está ${this.propiedades.estado}`,
      );
    }
  }

  private static ubicacion(
    ubicacion: UbicacionInventario | null,
    presencia: Presencia,
    tipoExigido: TipoUbicacion | undefined,
    rol: 'origen' | 'destino',
  ): UbicacionMovimiento | null {
    if (presencia === 'requerida' && !ubicacion) {
      throw new ReglaNegocioError(`Este movimiento requiere ${rol}`);
    }
    if (presencia === 'prohibida' && ubicacion) {
      throw new ReglaNegocioError(`Este movimiento no lleva ${rol}`);
    }
    if (!ubicacion) return null;
    ubicacion.exigirActiva();
    if (tipoExigido && ubicacion.tipo !== tipoExigido) {
      throw new ReglaNegocioError(
        `El ${rol} de este movimiento debe ser una ${tipoExigido}`,
      );
    }
    return {
      id: ubicacion.id,
      tipo: ubicacion.tipo,
      nombre: ubicacion.nombre,
      activa: ubicacion.activa,
    };
  }

  private static lineas(datos: DatosMovimiento): LineaMovimiento[] {
    if (datos.lineas.length === 0) {
      throw new ReglaNegocioError(
        'El movimiento debe tener al menos un elemento',
      );
    }
    if (datos.lineas.length > MAXIMO_LINEAS_MOVIMIENTO) {
      throw new ReglaNegocioError(
        `Un movimiento admite máximo ${MAXIMO_LINEAS_MOVIMIENTO} elementos`,
      );
    }
    const claves = new Set<string>();
    return datos.lineas.map((dato) => {
      const unidad = identificarUnidad(dato);
      if (claves.has(unidad.claveControl)) {
        throw new ReglaNegocioError(
          `"${dato.insumo.nombre}" está repetido: únalo en una sola línea`,
        );
      }
      claves.add(unidad.claveControl);
      if (datos.tipo === 'entrada') dato.insumo.exigirActivo();
      const cantidad = cantidadPositiva(
        dato.cantidad,
        `La cantidad de "${dato.insumo.nombre}"`,
      );
      if (dato.equipo && cantidad !== 1) {
        throw new ReglaNegocioError(
          `El equipo ${dato.equipo.numeroSerie} se mueve de a una unidad`,
        );
      }
      return {
        ...unidad,
        id: crypto.randomUUID(),
        cantidad,
        observaciones: textoOpcional(
          dato.observaciones,
          'Las observaciones',
          5000,
        ),
        insumoCodigo: dato.insumo.codigo,
        insumoNombre: dato.insumo.nombre,
        unidadMedida: dato.insumo.unidadMedida,
        numeroLote: dato.lote?.numeroLote ?? null,
        loteVencimiento: dato.lote?.fechaVencimiento ?? null,
        numeroSerie: dato.equipo?.numeroSerie ?? null,
        equipoEstado: dato.equipo?.estado ?? null,
      };
    });
  }

  /** "MOV-20261111-1A2B3C4D": día de Colombia y un sufijo aleatorio. */
  private static nuevoCodigo(ahora: Date): string {
    const sufijo = crypto
      .randomUUID()
      .replaceAll('-', '')
      .slice(0, 8)
      .toUpperCase();
    return `MOV-${diaColombia(ahora)}-${sufijo}`;
  }
}
