import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';

export const TIPOS_UBICACION = ['bodega', 'ambulancia'] as const;
export type TipoUbicacion = (typeof TIPOS_UBICACION)[number];

export interface PropiedadesUbicacionInventario {
  id: string;
  tipo: TipoUbicacion;
  bodegaId: string | null;
  ambulanciaId: string | null;
  activa: boolean;
  creadaEn: Date;
  /** Solo lectura: nombre de la bodega o código de la ambulancia. */
  nombre: string | null;
}

/** Dónde está el inventario: una bodega o una ambulancia, nunca las dos. */
export class UbicacionInventario {
  private constructor(
    private readonly propiedades: PropiedadesUbicacionInventario,
  ) {}

  static deBodega(bodegaId: string, ahora: Date): UbicacionInventario {
    return UbicacionInventario.nueva('bodega', bodegaId, null, ahora);
  }

  static deAmbulancia(ambulanciaId: string, ahora: Date): UbicacionInventario {
    return UbicacionInventario.nueva('ambulancia', null, ambulanciaId, ahora);
  }

  static reconstruir(
    propiedades: PropiedadesUbicacionInventario,
  ): UbicacionInventario {
    return new UbicacionInventario({ ...propiedades });
  }

  private static nueva(
    tipo: TipoUbicacion,
    bodegaId: string | null,
    ambulanciaId: string | null,
    ahora: Date,
  ): UbicacionInventario {
    return new UbicacionInventario({
      id: crypto.randomUUID(),
      tipo,
      bodegaId,
      ambulanciaId,
      activa: true,
      creadaEn: ahora,
      nombre: null,
    });
  }

  get id(): string {
    return this.propiedades.id;
  }
  get tipo(): TipoUbicacion {
    return this.propiedades.tipo;
  }
  get bodegaId(): string | null {
    return this.propiedades.bodegaId;
  }
  get ambulanciaId(): string | null {
    return this.propiedades.ambulanciaId;
  }
  get activa(): boolean {
    return this.propiedades.activa;
  }
  get creadaEn(): Date {
    return this.propiedades.creadaEn;
  }
  get nombre(): string | null {
    return this.propiedades.nombre;
  }

  esAmbulancia(): boolean {
    return this.propiedades.tipo === 'ambulancia';
  }

  esBodega(): boolean {
    return this.propiedades.tipo === 'bodega';
  }

  cambiarEstado(activa: boolean): void {
    this.propiedades.activa = activa;
  }

  exigirActiva(): void {
    if (!this.propiedades.activa) {
      throw new ReglaNegocioError(
        `La ubicación ${this.propiedades.nombre ?? this.propiedades.id} está inactiva`,
      );
    }
  }
}
