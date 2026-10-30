import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';

export const ESTADOS_ASIGNACION = [
  'asignada',
  'en_camino',
  'en_escena',
  'atendiendo',
  'trasladando',
  'finalizada',
  'cancelada',
] as const;
export type EstadoAsignacion = (typeof ESTADOS_ASIGNACION)[number];

/** Estados que marca la tripulación (o el despachador) a medida que avanza. */
export const ESTADOS_AVANCE = [
  'en_camino',
  'en_escena',
  'atendiendo',
  'trasladando',
  'finalizada',
] as const;
export type EstadoAvance = (typeof ESTADOS_AVANCE)[number];

export const ESTADOS_ACTIVOS_ASIGNACION: readonly EstadoAsignacion[] = [
  'asignada',
  'en_camino',
  'en_escena',
  'atendiendo',
  'trasladando',
];

/**
 * Ciclo de atención: despacho → desplazamiento → llegada → atención →
 * traslado → cierre. Desde la escena o durante la atención se puede cerrar
 * sin trasladar (sin paciente, atendido en el sitio, rechazo del traslado),
 * siempre con un motivo.
 */
const TRANSICIONES_AVANCE: Record<EstadoAsignacion, readonly EstadoAvance[]> = {
  asignada: ['en_camino'],
  en_camino: ['en_escena'],
  en_escena: ['atendiendo', 'finalizada'],
  atendiendo: ['trasladando', 'finalizada'],
  trasladando: ['finalizada'],
  finalizada: [],
  cancelada: [],
};

/** Una vez en la escena ya no se cancela: se finaliza. */
const ESTADOS_CANCELABLES: readonly EstadoAsignacion[] = [
  'asignada',
  'en_camino',
];

export interface PropiedadesAsignacion {
  id: string;
  emergenciaId: string;
  ambulanciaId: string;
  turnoId: string | null;
  asignadaPorId: string | null;
  estado: EstadoAsignacion;
  motivoCancelacion: string | null;
  asignadaEn: Date;
  salidaEn: Date | null;
  llegadaEscenaEn: Date | null;
  atencionInicioEn: Date | null;
  salidaEscenaEn: Date | null;
  llegadaDestinoEn: Date | null;
  finalizadaEn: Date | null;
  /** Solo lectura, para mostrar. */
  numeroEmergencia: string | null;
  ambulanciaCodigo: string | null;
  asignadaPorNombre: string | null;
}

export class Asignacion {
  private constructor(private readonly propiedades: PropiedadesAsignacion) {}

  static crear(datos: {
    emergenciaId: string;
    ambulanciaId: string;
    turnoId: string;
    asignadaPorId: string | null;
    asignadaEn: Date;
  }): Asignacion {
    return new Asignacion({
      id: crypto.randomUUID(),
      ...datos,
      estado: 'asignada',
      motivoCancelacion: null,
      salidaEn: null,
      llegadaEscenaEn: null,
      atencionInicioEn: null,
      salidaEscenaEn: null,
      llegadaDestinoEn: null,
      finalizadaEn: null,
      numeroEmergencia: null,
      ambulanciaCodigo: null,
      asignadaPorNombre: null,
    });
  }

  static reconstruir(propiedades: PropiedadesAsignacion): Asignacion {
    return new Asignacion({ ...propiedades });
  }

  static siguientesEstados(estado: EstadoAsignacion): readonly EstadoAvance[] {
    return TRANSICIONES_AVANCE[estado];
  }

  get id(): string {
    return this.propiedades.id;
  }
  get emergenciaId(): string {
    return this.propiedades.emergenciaId;
  }
  get ambulanciaId(): string {
    return this.propiedades.ambulanciaId;
  }
  get turnoId(): string | null {
    return this.propiedades.turnoId;
  }
  get asignadaPorId(): string | null {
    return this.propiedades.asignadaPorId;
  }
  get estado(): EstadoAsignacion {
    return this.propiedades.estado;
  }
  get motivoCancelacion(): string | null {
    return this.propiedades.motivoCancelacion;
  }
  get asignadaEn(): Date {
    return this.propiedades.asignadaEn;
  }
  get salidaEn(): Date | null {
    return this.propiedades.salidaEn;
  }
  get llegadaEscenaEn(): Date | null {
    return this.propiedades.llegadaEscenaEn;
  }
  get atencionInicioEn(): Date | null {
    return this.propiedades.atencionInicioEn;
  }
  get salidaEscenaEn(): Date | null {
    return this.propiedades.salidaEscenaEn;
  }
  get llegadaDestinoEn(): Date | null {
    return this.propiedades.llegadaDestinoEn;
  }
  get finalizadaEn(): Date | null {
    return this.propiedades.finalizadaEn;
  }
  get numeroEmergencia(): string | null {
    return this.propiedades.numeroEmergencia;
  }
  get ambulanciaCodigo(): string | null {
    return this.propiedades.ambulanciaCodigo;
  }
  get asignadaPorNombre(): string | null {
    return this.propiedades.asignadaPorNombre;
  }

  estaActiva(): boolean {
    return ESTADOS_ACTIVOS_ASIGNACION.includes(this.propiedades.estado);
  }

  /** Cerrar sin haber trasladado al paciente exige explicar por qué. */
  cierreRequiereMotivo(nuevo: EstadoAvance): boolean {
    return nuevo === 'finalizada' && this.propiedades.estado !== 'trasladando';
  }

  avanzar(nuevo: EstadoAvance, fecha: Date): void {
    const actual = this.propiedades.estado;
    if (!TRANSICIONES_AVANCE[actual].includes(nuevo)) {
      throw new ReglaNegocioError(`No se puede pasar de ${actual} a ${nuevo}`);
    }
    const p = this.propiedades;
    switch (nuevo) {
      case 'en_camino':
        p.salidaEn = fecha;
        break;
      case 'en_escena':
        p.llegadaEscenaEn = fecha;
        break;
      case 'atendiendo':
        p.atencionInicioEn = fecha;
        break;
      case 'trasladando':
        // Paciente a bordo: la ambulancia sale de la escena.
        p.salidaEscenaEn = fecha;
        break;
      case 'finalizada':
        // Si venía trasladando, finalizar es llegar al destino y entregar al paciente.
        if (actual === 'trasladando') p.llegadaDestinoEn = fecha;
        p.finalizadaEn = fecha;
        break;
    }
    p.estado = nuevo;
  }

  cancelar(motivo: string, fecha: Date): void {
    if (!ESTADOS_CANCELABLES.includes(this.propiedades.estado)) {
      throw new ReglaNegocioError(
        `No se puede cancelar una asignación ${this.propiedades.estado}`,
      );
    }
    this.propiedades.estado = 'cancelada';
    this.propiedades.motivoCancelacion = motivo.trim();
    this.propiedades.finalizadaEn = fecha;
  }
}
