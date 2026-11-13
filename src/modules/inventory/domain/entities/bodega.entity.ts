import { fusionarDefinidos } from '../../../../common/utils/objetos.js';
import {
  codigo,
  textoObligatorio,
  textoOpcional,
} from '../services/validaciones.js';

export interface DatosBodega {
  codigo: string;
  nombre: string;
  ubicacion: string | null;
  responsableId: string | null;
}

export interface PropiedadesBodega extends DatosBodega {
  id: string;
  activa: boolean;
  creadaEn: Date;
  actualizadaEn: Date;
  /** Solo lectura. */
  responsableNombre: string | null;
  ubicacionInventarioId: string | null;
}

export class Bodega {
  private constructor(private readonly propiedades: PropiedadesBodega) {}

  static crear(datos: DatosBodega, ahora: Date): Bodega {
    return new Bodega({
      ...Bodega.validar(datos),
      id: crypto.randomUUID(),
      activa: true,
      creadaEn: ahora,
      actualizadaEn: ahora,
      responsableNombre: null,
      ubicacionInventarioId: null,
    });
  }

  static reconstruir(propiedades: PropiedadesBodega): Bodega {
    return new Bodega({ ...propiedades });
  }

  get id(): string {
    return this.propiedades.id;
  }
  get codigo(): string {
    return this.propiedades.codigo;
  }
  get nombre(): string {
    return this.propiedades.nombre;
  }
  get ubicacion(): string | null {
    return this.propiedades.ubicacion;
  }
  get responsableId(): string | null {
    return this.propiedades.responsableId;
  }
  get responsableNombre(): string | null {
    return this.propiedades.responsableNombre;
  }
  get activa(): boolean {
    return this.propiedades.activa;
  }
  get creadaEn(): Date {
    return this.propiedades.creadaEn;
  }
  get actualizadaEn(): Date {
    return this.propiedades.actualizadaEn;
  }
  get ubicacionInventarioId(): string | null {
    return this.propiedades.ubicacionInventarioId;
  }

  actualizar(cambios: Partial<DatosBodega>, ahora: Date): void {
    const actual: DatosBodega = {
      codigo: this.propiedades.codigo,
      nombre: this.propiedades.nombre,
      ubicacion: this.propiedades.ubicacion,
      responsableId: this.propiedades.responsableId,
    };
    Object.assign(
      this.propiedades,
      Bodega.validar(fusionarDefinidos(actual, cambios)),
      { actualizadaEn: ahora },
    );
  }

  cambiarEstado(activa: boolean, ahora: Date): void {
    this.propiedades.activa = activa;
    this.propiedades.actualizadaEn = ahora;
  }

  private static validar(datos: DatosBodega): DatosBodega {
    return {
      codigo: codigo(datos.codigo, 'El código'),
      nombre: textoObligatorio(datos.nombre, 'El nombre', 150),
      ubicacion: textoOpcional(datos.ubicacion, 'La ubicación', 250),
      responsableId: datos.responsableId,
    };
  }
}
