import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import { fusionarDefinidos } from '../../../../common/utils/objetos.js';
import {
  cantidadNoNegativa,
  codigo,
  textoObligatorio,
  textoOpcional,
} from '../services/validaciones.js';

export const TIPOS_INSUMO = [
  'medicamento',
  'dispositivo_medico',
  'insumo_asistencial',
  'equipo_biomedico',
  'oxigeno_medicinal',
  'otro',
] as const;
export type TipoInsumo = (typeof TIPOS_INSUMO)[number];

/** Cómo se identifica cada unidad en existencias y movimientos. */
export type ControlInsumo = 'serie' | 'lote' | 'insumo';

export interface DatosInsumo {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  tipo: TipoInsumo;
  categoria: string | null;
  unidadMedida: string;
  marca: string | null;
  fabricante: string | null;
  requiereLote: boolean;
  requiereVencimiento: boolean;
  requiereRegistroSanitario: boolean;
  requiereSerie: boolean;
  esControlEspecial: boolean;
  stockMinimo: number;
}

export interface PropiedadesInsumo extends DatosInsumo {
  id: string;
  activo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
}

const CAMPOS_DE_CONTROL = ['requiereLote', 'requiereSerie'] as const;

/**
 * Elemento del catálogo. Sus banderas `requiere*` deciden cómo se controla:
 * por serie (un equipo a la vez), por lote o solo por cantidad.
 */
export class Insumo {
  private constructor(private readonly propiedades: PropiedadesInsumo) {}

  static crear(datos: DatosInsumo, ahora: Date): Insumo {
    return new Insumo({
      ...Insumo.validar(datos),
      id: crypto.randomUUID(),
      activo: true,
      creadoEn: ahora,
      actualizadoEn: ahora,
    });
  }

  static reconstruir(propiedades: PropiedadesInsumo): Insumo {
    return new Insumo({ ...propiedades });
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
  get descripcion(): string | null {
    return this.propiedades.descripcion;
  }
  get tipo(): TipoInsumo {
    return this.propiedades.tipo;
  }
  get categoria(): string | null {
    return this.propiedades.categoria;
  }
  get unidadMedida(): string {
    return this.propiedades.unidadMedida;
  }
  get marca(): string | null {
    return this.propiedades.marca;
  }
  get fabricante(): string | null {
    return this.propiedades.fabricante;
  }
  get requiereLote(): boolean {
    return this.propiedades.requiereLote;
  }
  get requiereVencimiento(): boolean {
    return this.propiedades.requiereVencimiento;
  }
  get requiereRegistroSanitario(): boolean {
    return this.propiedades.requiereRegistroSanitario;
  }
  get requiereSerie(): boolean {
    return this.propiedades.requiereSerie;
  }
  get esControlEspecial(): boolean {
    return this.propiedades.esControlEspecial;
  }
  get stockMinimo(): number {
    return this.propiedades.stockMinimo;
  }
  get activo(): boolean {
    return this.propiedades.activo;
  }
  get creadoEn(): Date {
    return this.propiedades.creadoEn;
  }
  get actualizadoEn(): Date {
    return this.propiedades.actualizadoEn;
  }

  get control(): ControlInsumo {
    if (this.propiedades.requiereSerie) return 'serie';
    if (this.propiedades.requiereLote) return 'lote';
    return 'insumo';
  }

  /** Si los cambios alteran cómo se identifican sus existencias. */
  cambiaControl(cambios: Partial<DatosInsumo>): boolean {
    return CAMPOS_DE_CONTROL.some(
      (campo) =>
        cambios[campo] !== undefined &&
        cambios[campo] !== this.propiedades[campo],
    );
  }

  actualizar(cambios: Partial<DatosInsumo>, ahora: Date): void {
    const { id, activo, creadoEn } = this.propiedades;
    Object.assign(this.propiedades, {
      ...Insumo.validar(fusionarDefinidos(this.datos(), cambios)),
      id,
      activo,
      creadoEn,
      actualizadoEn: ahora,
    });
  }

  cambiarEstado(activo: boolean, ahora: Date): void {
    this.propiedades.activo = activo;
    this.propiedades.actualizadoEn = ahora;
  }

  exigirActivo(): void {
    if (!this.propiedades.activo) {
      throw new ReglaNegocioError(`El insumo "${this.nombre}" está inactivo`);
    }
  }

  private datos(): DatosInsumo {
    const {
      id: _id,
      activo: _a,
      creadoEn: _c,
      actualizadoEn: _u,
      ...datos
    } = this.propiedades;
    return datos;
  }

  private static validar(datos: DatosInsumo): DatosInsumo {
    if (datos.requiereSerie && datos.requiereLote) {
      throw new ReglaNegocioError(
        'Un insumo controlado por serie no se controla por lote',
      );
    }
    if (datos.requiereVencimiento && !datos.requiereLote) {
      throw new ReglaNegocioError(
        'El vencimiento se registra en cada lote: active "requiere lote"',
      );
    }
    return {
      ...datos,
      codigo: codigo(datos.codigo, 'El código'),
      nombre: textoObligatorio(datos.nombre, 'El nombre', 150),
      descripcion: textoOpcional(datos.descripcion, 'La descripción', 5000),
      categoria: textoOpcional(datos.categoria, 'La categoría', 100),
      unidadMedida: textoObligatorio(
        datos.unidadMedida,
        'La unidad de medida',
        30,
      ),
      marca: textoOpcional(datos.marca, 'La marca', 100),
      fabricante: textoOpcional(datos.fabricante, 'El fabricante', 150),
      stockMinimo: cantidadNoNegativa(datos.stockMinimo, 'El stock mínimo'),
    };
  }
}
