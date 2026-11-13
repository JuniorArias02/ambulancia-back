import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import { fusionarDefinidos } from '../../../../common/utils/objetos.js';
import {
  cantidadNoNegativa,
  cantidadPositiva,
  codigo,
  exigirOrden,
  fechaOpcional,
  textoObligatorio,
  textoOpcional,
} from '../services/validaciones.js';
import type { Insumo } from './insumo.entity.js';

export interface DatosDetallePerfil {
  cantidadRequerida: number;
  cantidadMinima: number | null;
  obligatorio: boolean;
  observaciones: string | null;
}

export interface DetallePerfil extends DatosDetallePerfil {
  id: string;
  insumoId: string;
  /** Solo lectura. */
  insumoCodigo: string;
  insumoNombre: string;
  unidadMedida: string;
  /** Los equipos (por serie) se cuentan en unidades enteras. */
  soloEnteros: boolean;
}

export interface DatosPerfil {
  nombre: string;
  descripcion: string | null;
  vigenteDesde: string | null;
  vigenteHasta: string | null;
}

export interface DatosNuevoPerfil extends DatosPerfil {
  tipoAmbulanciaId: string;
  codigo: string;
  detalles: (DatosDetallePerfil & { insumo: Insumo })[];
}

export interface PropiedadesPerfilDotacion extends DatosPerfil {
  id: string;
  tipoAmbulanciaId: string;
  codigo: string;
  version: number;
  activo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
  detalles: DetallePerfil[];
  /** Solo lectura. */
  tipoAmbulanciaNombre: string | null;
}

/**
 * Lo que debe llevar un tipo de ambulancia. Nace inactivo; al activarlo se
 * desactivan los demás del mismo tipo (uno solo rige a la vez). Cambiar la
 * dotación de fondo es crear una versión nueva.
 */
export class PerfilDotacion {
  private constructor(
    private readonly propiedades: PropiedadesPerfilDotacion,
  ) {}

  static crear(
    datos: DatosNuevoPerfil,
    version: number,
    ahora: Date,
  ): PerfilDotacion {
    const perfil = new PerfilDotacion({
      ...PerfilDotacion.validar(datos),
      id: crypto.randomUUID(),
      tipoAmbulanciaId: datos.tipoAmbulanciaId,
      codigo: codigo(datos.codigo, 'El código'),
      version,
      activo: false,
      creadoEn: ahora,
      actualizadoEn: ahora,
      detalles: [],
      tipoAmbulanciaNombre: null,
    });
    for (const { insumo, ...detalle } of datos.detalles) {
      perfil.agregarDetalle(insumo, detalle, ahora);
    }
    return perfil;
  }

  static reconstruir(propiedades: PropiedadesPerfilDotacion): PerfilDotacion {
    return new PerfilDotacion({
      ...propiedades,
      detalles: propiedades.detalles.map((d) => ({ ...d })),
    });
  }

  get id(): string {
    return this.propiedades.id;
  }
  get tipoAmbulanciaId(): string {
    return this.propiedades.tipoAmbulanciaId;
  }
  get tipoAmbulanciaNombre(): string | null {
    return this.propiedades.tipoAmbulanciaNombre;
  }
  get codigo(): string {
    return this.propiedades.codigo;
  }
  get nombre(): string {
    return this.propiedades.nombre;
  }
  get version(): number {
    return this.propiedades.version;
  }
  get descripcion(): string | null {
    return this.propiedades.descripcion;
  }
  get vigenteDesde(): string | null {
    return this.propiedades.vigenteDesde;
  }
  get vigenteHasta(): string | null {
    return this.propiedades.vigenteHasta;
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
  get detalles(): readonly DetallePerfil[] {
    return this.propiedades.detalles;
  }

  /** El que rige hoy: activo y dentro de su vigencia. */
  vigenteEn(hoy: string): boolean {
    const { activo, vigenteDesde, vigenteHasta } = this.propiedades;
    return (
      activo &&
      (vigenteDesde === null || vigenteDesde <= hoy) &&
      (vigenteHasta === null || vigenteHasta >= hoy)
    );
  }

  buscarDetalleDeInsumo(insumoId: string): DetallePerfil | null {
    return (
      this.propiedades.detalles.find((d) => d.insumoId === insumoId) ?? null
    );
  }

  /** Copia con versión nueva, inactiva y sin vigencia, para ajustarla y activarla. */
  nuevaVersion(version: number, ahora: Date): PerfilDotacion {
    return new PerfilDotacion({
      ...this.propiedades,
      id: crypto.randomUUID(),
      version,
      activo: false,
      vigenteDesde: null,
      vigenteHasta: null,
      creadoEn: ahora,
      actualizadoEn: ahora,
      detalles: this.propiedades.detalles.map((d) => ({
        ...d,
        id: crypto.randomUUID(),
      })),
    });
  }

  actualizar(cambios: Partial<DatosPerfil>, ahora: Date): void {
    const actual: DatosPerfil = {
      nombre: this.propiedades.nombre,
      descripcion: this.propiedades.descripcion,
      vigenteDesde: this.propiedades.vigenteDesde,
      vigenteHasta: this.propiedades.vigenteHasta,
    };
    Object.assign(
      this.propiedades,
      PerfilDotacion.validar(fusionarDefinidos(actual, cambios)),
      { actualizadoEn: ahora },
    );
  }

  activar(hoy: string, ahora: Date): void {
    if (this.propiedades.detalles.length === 0) {
      throw new ReglaNegocioError(
        'Agregue al menos un elemento antes de activar el perfil',
      );
    }
    const { vigenteHasta } = this.propiedades;
    if (vigenteHasta !== null && vigenteHasta < hoy) {
      throw new ReglaNegocioError('La vigencia del perfil ya terminó');
    }
    this.propiedades.activo = true;
    this.propiedades.actualizadoEn = ahora;
  }

  desactivar(ahora: Date): void {
    this.propiedades.activo = false;
    this.propiedades.actualizadoEn = ahora;
  }

  agregarDetalle(
    insumo: Insumo,
    datos: DatosDetallePerfil,
    ahora: Date,
  ): DetallePerfil {
    insumo.exigirActivo();
    if (this.buscarDetalleDeInsumo(insumo.id)) {
      throw new ReglaNegocioError(`"${insumo.nombre}" ya está en el perfil`);
    }
    const detalle: DetallePerfil = {
      ...PerfilDotacion.validarDetalle(
        datos,
        insumo.requiereSerie,
        insumo.nombre,
      ),
      id: crypto.randomUUID(),
      insumoId: insumo.id,
      insumoCodigo: insumo.codigo,
      insumoNombre: insumo.nombre,
      unidadMedida: insumo.unidadMedida,
      soloEnteros: insumo.requiereSerie,
    };
    this.propiedades.detalles.push(detalle);
    this.propiedades.actualizadoEn = ahora;
    return detalle;
  }

  actualizarDetalle(
    detalleId: string,
    cambios: Partial<DatosDetallePerfil>,
    ahora: Date,
  ): DetallePerfil {
    const detalle = this.exigirDetalle(detalleId);
    const actual: DatosDetallePerfil = {
      cantidadRequerida: detalle.cantidadRequerida,
      cantidadMinima: detalle.cantidadMinima,
      obligatorio: detalle.obligatorio,
      observaciones: detalle.observaciones,
    };
    Object.assign(
      detalle,
      PerfilDotacion.validarDetalle(
        fusionarDefinidos(actual, cambios),
        detalle.soloEnteros,
        detalle.insumoNombre,
      ),
    );
    this.propiedades.actualizadoEn = ahora;
    return detalle;
  }

  quitarDetalle(detalleId: string, ahora: Date): void {
    this.exigirDetalle(detalleId);
    if (this.propiedades.activo && this.propiedades.detalles.length === 1) {
      throw new ReglaNegocioError(
        'Un perfil activo no puede quedar sin elementos',
      );
    }
    this.propiedades.detalles = this.propiedades.detalles.filter(
      (d) => d.id !== detalleId,
    );
    this.propiedades.actualizadoEn = ahora;
  }

  private exigirDetalle(detalleId: string): DetallePerfil {
    const detalle = this.propiedades.detalles.find((d) => d.id === detalleId);
    if (!detalle) {
      throw new ReglaNegocioError('El elemento no pertenece a este perfil');
    }
    return detalle;
  }

  private static validar(datos: DatosPerfil): DatosPerfil {
    const vigenteDesde = fechaOpcional(datos.vigenteDesde, 'La vigencia desde');
    const vigenteHasta = fechaOpcional(datos.vigenteHasta, 'La vigencia hasta');
    exigirOrden(
      vigenteDesde,
      vigenteHasta,
      'La vigencia termina antes de empezar',
    );
    return {
      nombre: textoObligatorio(datos.nombre, 'El nombre', 150),
      descripcion: textoOpcional(datos.descripcion, 'La descripción', 5000),
      vigenteDesde,
      vigenteHasta,
    };
  }

  private static validarDetalle(
    datos: DatosDetallePerfil,
    soloEnteros: boolean,
    nombre: string,
  ): DatosDetallePerfil {
    const cantidadRequerida = cantidadPositiva(
      datos.cantidadRequerida,
      `La cantidad requerida de "${nombre}"`,
    );
    const cantidadMinima =
      datos.cantidadMinima === null
        ? null
        : cantidadNoNegativa(
            datos.cantidadMinima,
            `La cantidad mínima de "${nombre}"`,
          );
    if (cantidadMinima !== null && cantidadMinima > cantidadRequerida) {
      throw new ReglaNegocioError(
        `La cantidad mínima de "${nombre}" no puede superar la requerida`,
      );
    }
    if (
      soloEnteros &&
      (!Number.isInteger(cantidadRequerida) ||
        (cantidadMinima !== null && !Number.isInteger(cantidadMinima)))
    ) {
      throw new ReglaNegocioError(`"${nombre}" se cuenta en unidades enteras`);
    }
    return {
      cantidadRequerida,
      cantidadMinima,
      obligatorio: datos.obligatorio,
      observaciones: textoOpcional(
        datos.observaciones,
        'Las observaciones',
        5000,
      ),
    };
  }
}
