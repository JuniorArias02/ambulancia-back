import type { NombreRol } from '../../../../common/constants/roles.js';
import { Roles } from '../../../../common/constants/roles.js';
import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';

export const FUNCIONES_TRIPULANTE = [
  'conductor',
  'paramedico',
  'medico',
] as const;
export type FuncionTripulante = (typeof FUNCIONES_TRIPULANTE)[number];

export const ESTADOS_TURNO = ['activo', 'finalizado'] as const;
export type EstadoTurno = (typeof ESTADOS_TURNO)[number];

export const MAXIMO_INTEGRANTES = 4;

/** Qué función puede cumplir cada rol dentro de una tripulación. */
const FUNCIONES_POR_ROL: Partial<
  Record<NombreRol, readonly FuncionTripulante[]>
> = {
  [Roles.CONDUCTOR]: ['conductor'],
  [Roles.PARAMEDICO]: ['paramedico', 'medico'],
};

export interface IntegranteTurno {
  usuarioId: string;
  funcion: FuncionTripulante;
  /** Solo lectura, para mostrar. */
  nombreCompleto: string | null;
}

export interface PropiedadesTurno {
  id: string;
  ambulanciaId: string;
  /** Solo lectura, para mostrar. */
  ambulanciaCodigo: string | null;
  inicio: Date;
  fin: Date | null;
  estado: EstadoTurno;
  integrantes: IntegranteTurno[];
}

export interface NuevoIntegrante {
  usuarioId: string;
  funcion: FuncionTripulante;
}

export class Turno {
  private constructor(private readonly propiedades: PropiedadesTurno) {}

  static iniciar(datos: {
    ambulanciaId: string;
    integrantes: NuevoIntegrante[];
    inicio: Date;
  }): Turno {
    return new Turno({
      id: crypto.randomUUID(),
      ambulanciaId: datos.ambulanciaId,
      ambulanciaCodigo: null,
      inicio: datos.inicio,
      fin: null,
      estado: 'activo',
      integrantes: Turno.validarIntegrantes(datos.integrantes),
    });
  }

  static reconstruir(propiedades: PropiedadesTurno): Turno {
    return new Turno({
      ...propiedades,
      integrantes: propiedades.integrantes.map((i) => ({ ...i })),
    });
  }

  static puedeCumplir(rol: NombreRol, funcion: FuncionTripulante): boolean {
    return FUNCIONES_POR_ROL[rol]?.includes(funcion) ?? false;
  }

  /** Una ambulancia sale con quien la maneje y con quien atienda al paciente. */
  private static validarIntegrantes(
    integrantes: NuevoIntegrante[],
  ): IntegranteTurno[] {
    if (integrantes.length > MAXIMO_INTEGRANTES) {
      throw new ReglaNegocioError(
        `Un turno admite máximo ${MAXIMO_INTEGRANTES} integrantes`,
      );
    }
    const ids = new Set(integrantes.map((i) => i.usuarioId));
    if (ids.size !== integrantes.length) {
      throw new ReglaNegocioError('Un usuario no puede repetirse en el turno');
    }
    if (!integrantes.some((i) => i.funcion === 'conductor')) {
      throw new ReglaNegocioError('El turno necesita un conductor');
    }
    if (!integrantes.some((i) => i.funcion !== 'conductor')) {
      throw new ReglaNegocioError(
        'El turno necesita un paramédico o un médico',
      );
    }
    return integrantes.map((i) => ({ ...i, nombreCompleto: null }));
  }

  get id(): string {
    return this.propiedades.id;
  }
  get ambulanciaId(): string {
    return this.propiedades.ambulanciaId;
  }
  get ambulanciaCodigo(): string | null {
    return this.propiedades.ambulanciaCodigo;
  }
  get inicio(): Date {
    return this.propiedades.inicio;
  }
  get fin(): Date | null {
    return this.propiedades.fin;
  }
  get estado(): EstadoTurno {
    return this.propiedades.estado;
  }
  get integrantes(): readonly IntegranteTurno[] {
    return this.propiedades.integrantes;
  }

  estaActivo(): boolean {
    return this.propiedades.estado === 'activo';
  }

  incluyeA(usuarioId: string): boolean {
    return this.propiedades.integrantes.some((i) => i.usuarioId === usuarioId);
  }

  /** Cambio de tripulación a mitad de turno (por ejemplo, relevo del conductor). */
  reemplazarIntegrantes(integrantes: NuevoIntegrante[]): void {
    this.exigirActivo();
    this.propiedades.integrantes = Turno.validarIntegrantes(integrantes);
  }

  finalizar(fecha: Date): void {
    this.exigirActivo();
    this.propiedades.estado = 'finalizado';
    this.propiedades.fin = fecha;
  }

  private exigirActivo(): void {
    if (!this.estaActivo()) {
      throw new ReglaNegocioError('El turno ya está finalizado');
    }
  }
}
