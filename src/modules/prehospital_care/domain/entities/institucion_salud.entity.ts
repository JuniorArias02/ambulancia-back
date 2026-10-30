import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type { PuntoGeografico } from '../../../../common/utils/geografia.js';

/** Nivel de complejidad de los servicios de salud en Colombia. */
export const NIVELES_COMPLEJIDAD = ['baja', 'mediana', 'alta'] as const;
export type NivelComplejidad = (typeof NIVELES_COMPLEJIDAD)[number];

export interface PropiedadesInstitucionSalud {
  id: string;
  nombre: string;
  /** Código de habilitación del REPS. */
  codigoHabilitacion: string | null;
  nivelComplejidad: NivelComplejidad | null;
  telefono: string | null;
  direccion: string | null;
  coordenadas: PuntoGeografico | null;
  activa: boolean;
}

/** `undefined` deja el valor igual; `null` lo borra. */
export interface DatosInstitucionSalud {
  nombre?: string;
  codigoHabilitacion?: string | null;
  nivelComplejidad?: NivelComplejidad | null;
  telefono?: string | null;
  direccion?: string | null;
  latitud?: number | null;
  longitud?: number | null;
}

/** Destino al que se traslada al paciente. Se inactiva, nunca se borra: la referencian las historias. */
export class InstitucionSalud {
  private constructor(
    private readonly propiedades: PropiedadesInstitucionSalud,
  ) {}

  static crear(
    datos: DatosInstitucionSalud & { nombre: string },
  ): InstitucionSalud {
    const institucion = new InstitucionSalud({
      id: crypto.randomUUID(),
      nombre: '',
      codigoHabilitacion: null,
      nivelComplejidad: null,
      telefono: null,
      direccion: null,
      coordenadas: null,
      activa: true,
    });
    institucion.actualizar(datos);
    return institucion;
  }

  static reconstruir(
    propiedades: PropiedadesInstitucionSalud,
  ): InstitucionSalud {
    return new InstitucionSalud({ ...propiedades });
  }

  private static limpiar(texto: string | null | undefined): string | null {
    const limpio = texto?.trim();
    return limpio ? limpio : null;
  }

  get id(): string {
    return this.propiedades.id;
  }
  get nombre(): string {
    return this.propiedades.nombre;
  }
  get codigoHabilitacion(): string | null {
    return this.propiedades.codigoHabilitacion;
  }
  get nivelComplejidad(): NivelComplejidad | null {
    return this.propiedades.nivelComplejidad;
  }
  get telefono(): string | null {
    return this.propiedades.telefono;
  }
  get direccion(): string | null {
    return this.propiedades.direccion;
  }
  get coordenadas(): PuntoGeografico | null {
    return this.propiedades.coordenadas;
  }
  get activa(): boolean {
    return this.propiedades.activa;
  }

  actualizar(datos: DatosInstitucionSalud): void {
    const p = this.propiedades;
    if (datos.nombre !== undefined) {
      const nombre = datos.nombre.trim();
      if (!nombre) throw new ReglaNegocioError('El nombre es obligatorio');
      p.nombre = nombre;
    }
    if (datos.codigoHabilitacion !== undefined) {
      p.codigoHabilitacion = InstitucionSalud.limpiar(datos.codigoHabilitacion);
    }
    if (datos.nivelComplejidad !== undefined) {
      p.nivelComplejidad = datos.nivelComplejidad;
    }
    if (datos.telefono !== undefined) {
      p.telefono = InstitucionSalud.limpiar(datos.telefono);
    }
    if (datos.direccion !== undefined) {
      p.direccion = InstitucionSalud.limpiar(datos.direccion);
    }
    if (datos.latitud !== undefined || datos.longitud !== undefined) {
      const hayLatitud = datos.latitud !== null && datos.latitud !== undefined;
      const hayLongitud =
        datos.longitud !== null && datos.longitud !== undefined;
      if (hayLatitud !== hayLongitud) {
        throw new ReglaNegocioError('Envíe la latitud y la longitud juntas');
      }
      p.coordenadas =
        hayLatitud && hayLongitud
          ? {
              latitud: datos.latitud as number,
              longitud: datos.longitud as number,
            }
          : null;
    }
  }

  cambiarEstado(activa: boolean): void {
    if (this.propiedades.activa === activa) {
      throw new ReglaNegocioError(
        `La institución ya está ${activa ? 'activa' : 'inactiva'}`,
      );
    }
    this.propiedades.activa = activa;
  }
}
