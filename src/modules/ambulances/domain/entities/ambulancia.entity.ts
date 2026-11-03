import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type { TipoAmbulancia } from './tipo_ambulancia.entity.js';

export const ESTADOS_OPERATIVOS = [
  'disponible',
  'en_servicio',
  'fuera_servicio',
  'mantenimiento',
] as const;
export type EstadoOperativo = (typeof ESTADOS_OPERATIVOS)[number];

/** Estados que un usuario puede poner a mano. */
export const ESTADOS_MANUALES = [
  'disponible',
  'fuera_servicio',
  'mantenimiento',
] as const;
export type EstadoManual = (typeof ESTADOS_MANUALES)[number];

/**
 * `en_servicio` lo ponen y lo quitan las asignaciones, nunca un usuario:
 * así una ambulancia atendiendo una emergencia no se libera por error.
 */
const TRANSICIONES_MANUALES: Record<EstadoOperativo, readonly EstadoManual[]> =
  {
    disponible: ['fuera_servicio', 'mantenimiento'],
    fuera_servicio: ['disponible', 'mantenimiento'],
    mantenimiento: ['disponible', 'fuera_servicio'],
    en_servicio: [],
  };

export interface UbicacionAmbulancia {
  latitud: number;
  longitud: number;
  registradaEn: Date;
}

export interface PropiedadesAmbulancia {
  id: string;
  codigo: string;
  placa: string;
  tipo: TipoAmbulancia;
  estadoOperativo: EstadoOperativo;
  ultimaUbicacion: UbicacionAmbulancia | null;
  creadaEn: Date;
}

export interface DatosNuevaAmbulancia {
  codigo: string;
  placa: string;
  tipo: TipoAmbulancia;
}

export interface DatosEditablesAmbulancia {
  codigo?: string;
  placa?: string;
  tipo?: TipoAmbulancia;
}

export class Ambulancia {
  private constructor(private readonly propiedades: PropiedadesAmbulancia) {}

  static crear(datos: DatosNuevaAmbulancia): Ambulancia {
    return new Ambulancia({
      id: crypto.randomUUID(),
      codigo: Ambulancia.normalizarCodigo(datos.codigo),
      placa: Ambulancia.normalizarPlaca(datos.placa),
      tipo: datos.tipo,
      // Nace fuera de servicio: se habilita cuando su tripulación la seleccione.
      estadoOperativo: 'fuera_servicio',
      ultimaUbicacion: null,
      creadaEn: new Date(),
    });
  }

  static reconstruir(propiedades: PropiedadesAmbulancia): Ambulancia {
    return new Ambulancia({ ...propiedades });
  }

  static normalizarCodigo(codigo: string): string {
    return codigo.trim().toUpperCase();
  }

  /** "abc-123" y "ABC 123" se guardan como "ABC123". */
  static normalizarPlaca(placa: string): string {
    return placa.replace(/[\s-]/g, '').toUpperCase();
  }

  static esEstadoValido(estado: string): estado is EstadoOperativo {
    return ESTADOS_OPERATIVOS.some((valido) => valido === estado);
  }

  get id(): string {
    return this.propiedades.id;
  }
  get codigo(): string {
    return this.propiedades.codigo;
  }
  get placa(): string {
    return this.propiedades.placa;
  }
  get tipo(): TipoAmbulancia {
    return this.propiedades.tipo;
  }
  get estadoOperativo(): EstadoOperativo {
    return this.propiedades.estadoOperativo;
  }
  get ultimaUbicacion(): UbicacionAmbulancia | null {
    return this.propiedades.ultimaUbicacion;
  }
  get creadaEn(): Date {
    return this.propiedades.creadaEn;
  }

  estaDisponible(): boolean {
    return this.propiedades.estadoOperativo === 'disponible';
  }

  actualizarDatos(datos: DatosEditablesAmbulancia): void {
    if (this.propiedades.estadoOperativo === 'en_servicio') {
      throw new ReglaNegocioError(
        'No se puede editar una ambulancia mientras está en servicio',
      );
    }
    if (datos.codigo !== undefined) {
      this.propiedades.codigo = Ambulancia.normalizarCodigo(datos.codigo);
    }
    if (datos.placa !== undefined) {
      this.propiedades.placa = Ambulancia.normalizarPlaca(datos.placa);
    }
    if (datos.tipo !== undefined) {
      this.propiedades.tipo = datos.tipo;
    }
  }

  cambiarEstadoManual(nuevo: EstadoManual): void {
    const actual = this.propiedades.estadoOperativo;
    if (actual === nuevo) {
      throw new ReglaNegocioError(`La ambulancia ya se encuentra ${nuevo}`);
    }
    if (!TRANSICIONES_MANUALES[actual].includes(nuevo)) {
      throw new ReglaNegocioError(
        `No se puede pasar de ${actual} a ${nuevo} manualmente`,
      );
    }
    this.propiedades.estadoOperativo = nuevo;
  }

  /** Lo usan las asignaciones al despachar; no es un cambio manual. */
  iniciarServicio(): void {
    if (this.propiedades.estadoOperativo !== 'disponible') {
      throw new ReglaNegocioError(
        `La ambulancia ${this.propiedades.codigo} no está disponible (${this.propiedades.estadoOperativo})`,
      );
    }
    this.propiedades.estadoOperativo = 'en_servicio';
  }

  /** Lo usan las asignaciones al finalizar o cancelar el servicio. */
  finalizarServicio(): void {
    if (this.propiedades.estadoOperativo !== 'en_servicio') {
      throw new ReglaNegocioError(
        `La ambulancia ${this.propiedades.codigo} no está en servicio`,
      );
    }
    this.propiedades.estadoOperativo = 'disponible';
  }
}
