import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import { fusionarDefinidos } from '../../../../common/utils/objetos.js';
import {
  exigirOrden,
  fechaOpcional,
  textoObligatorio,
  textoOpcional,
} from '../services/validaciones.js';
import type { Insumo } from './insumo.entity.js';
import { RegistroSanitario } from './registro_sanitario.entity.js';

export const ESTADOS_EQUIPO = [
  'operativo',
  'mantenimiento',
  'fuera_servicio',
  'baja',
] as const;
export type EstadoEquipo = (typeof ESTADOS_EQUIPO)[number];

export const TIPOS_MANTENIMIENTO = [
  'preventivo',
  'correctivo',
  'calibracion',
] as const;
export type TipoMantenimiento = (typeof TIPOS_MANTENIMIENTO)[number];

export interface CambiosEquipo {
  marca?: string | null;
  modelo?: string | null;
  fechaAdquisicion?: string | null;
  fechaProximoMantenimiento?: string | null;
  observaciones?: string | null;
}

export interface DatosEquipo extends Required<CambiosEquipo> {
  numeroSerie: string;
}

export interface PropiedadesEquipo extends DatosEquipo {
  id: string;
  insumoId: string;
  registroSanitarioId: string | null;
  estado: EstadoEquipo;
  fechaUltimoMantenimiento: string | null;
  creadoEn: Date;
  actualizadoEn: Date;
  /** Solo lectura. */
  insumoNombre: string | null;
}

export interface DatosMantenimiento {
  tipo: TipoMantenimiento;
  fechaMantenimiento: string;
  fechaProximo: string | null;
  responsable: string | null;
  proveedor: string | null;
  documentoSoporte: string | null;
  resultado: string | null;
  observaciones: string | null;
}

export interface Mantenimiento extends DatosMantenimiento {
  id: string;
  equipoId: string;
  creadoEn: Date;
}

/** Equipo biomédico individual. Se mueve de a uno y se sigue por su serie. */
export class Equipo {
  private constructor(private readonly propiedades: PropiedadesEquipo) {}

  static crear(
    insumo: Insumo,
    registro: RegistroSanitario | null,
    datos: DatosEquipo,
    ahora: Date,
    hoy: string,
  ): Equipo {
    insumo.exigirActivo();
    if (insumo.control !== 'serie') {
      throw new ReglaNegocioError(
        `"${insumo.nombre}" no se controla por número de serie`,
      );
    }
    RegistroSanitario.exigirParaInsumo(insumo, registro, hoy);
    return new Equipo({
      ...Equipo.validar(datos, hoy),
      numeroSerie: textoObligatorio(
        datos.numeroSerie,
        'El número de serie',
        100,
      ),
      id: crypto.randomUUID(),
      insumoId: insumo.id,
      registroSanitarioId: registro?.id ?? null,
      estado: 'operativo',
      fechaUltimoMantenimiento: null,
      creadoEn: ahora,
      actualizadoEn: ahora,
      insumoNombre: insumo.nombre,
    });
  }

  static reconstruir(propiedades: PropiedadesEquipo): Equipo {
    return new Equipo({ ...propiedades });
  }

  get id(): string {
    return this.propiedades.id;
  }
  get insumoId(): string {
    return this.propiedades.insumoId;
  }
  get registroSanitarioId(): string | null {
    return this.propiedades.registroSanitarioId;
  }
  get numeroSerie(): string {
    return this.propiedades.numeroSerie;
  }
  get marca(): string | null {
    return this.propiedades.marca;
  }
  get modelo(): string | null {
    return this.propiedades.modelo;
  }
  get fechaAdquisicion(): string | null {
    return this.propiedades.fechaAdquisicion;
  }
  get estado(): EstadoEquipo {
    return this.propiedades.estado;
  }
  get fechaUltimoMantenimiento(): string | null {
    return this.propiedades.fechaUltimoMantenimiento;
  }
  get fechaProximoMantenimiento(): string | null {
    return this.propiedades.fechaProximoMantenimiento;
  }
  get observaciones(): string | null {
    return this.propiedades.observaciones;
  }
  get creadoEn(): Date {
    return this.propiedades.creadoEn;
  }
  get actualizadoEn(): Date {
    return this.propiedades.actualizadoEn;
  }
  get insumoNombre(): string | null {
    return this.propiedades.insumoNombre;
  }

  actualizar(cambios: CambiosEquipo, ahora: Date, hoy: string): void {
    this.exigirNoDadoDeBaja();
    const actual: Required<CambiosEquipo> = {
      marca: this.propiedades.marca,
      modelo: this.propiedades.modelo,
      fechaAdquisicion: this.propiedades.fechaAdquisicion,
      fechaProximoMantenimiento: this.propiedades.fechaProximoMantenimiento,
      observaciones: this.propiedades.observaciones,
    };
    Object.assign(
      this.propiedades,
      Equipo.validar(fusionarDefinidos(actual, cambios), hoy),
      { actualizadoEn: ahora },
    );
  }

  /** La baja es definitiva. */
  cambiarEstado(estado: EstadoEquipo, ahora: Date): void {
    this.exigirNoDadoDeBaja();
    this.propiedades.estado = estado;
    this.propiedades.actualizadoEn = ahora;
  }

  /**
   * Un mantenimiento más reciente que el último actualiza las fechas del equipo;
   * uno anterior solo queda en el historial.
   */
  registrarMantenimiento(
    datos: DatosMantenimiento,
    ahora: Date,
    hoy: string,
  ): Mantenimiento {
    this.exigirNoDadoDeBaja();
    const fechaMantenimiento = fechaOpcional(
      datos.fechaMantenimiento,
      'La fecha del mantenimiento',
    );
    if (!fechaMantenimiento) {
      throw new ReglaNegocioError('La fecha del mantenimiento es obligatoria');
    }
    exigirOrden(
      fechaMantenimiento,
      hoy,
      'El mantenimiento no puede tener fecha futura',
    );
    const fechaProximo = fechaOpcional(datos.fechaProximo, 'La fecha próxima');
    if (fechaProximo && fechaProximo <= fechaMantenimiento) {
      throw new ReglaNegocioError(
        'El próximo mantenimiento debe ser posterior a este',
      );
    }

    const { fechaUltimoMantenimiento } = this.propiedades;
    if (
      !fechaUltimoMantenimiento ||
      fechaMantenimiento >= fechaUltimoMantenimiento
    ) {
      this.propiedades.fechaUltimoMantenimiento = fechaMantenimiento;
      this.propiedades.fechaProximoMantenimiento = fechaProximo;
      this.propiedades.actualizadoEn = ahora;
    }

    return {
      id: crypto.randomUUID(),
      equipoId: this.propiedades.id,
      tipo: datos.tipo,
      fechaMantenimiento,
      fechaProximo,
      responsable: textoOpcional(datos.responsable, 'El responsable', 150),
      proveedor: textoOpcional(datos.proveedor, 'El proveedor', 150),
      documentoSoporte: textoOpcional(
        datos.documentoSoporte,
        'El documento soporte',
        500,
      ),
      resultado: textoOpcional(datos.resultado, 'El resultado', 50),
      observaciones: textoOpcional(
        datos.observaciones,
        'Las observaciones',
        5000,
      ),
      creadoEn: ahora,
    };
  }

  private exigirNoDadoDeBaja(): void {
    if (this.propiedades.estado === 'baja') {
      throw new ReglaNegocioError(
        `El equipo ${this.propiedades.numeroSerie} está dado de baja`,
      );
    }
  }

  private static validar(
    datos: Required<CambiosEquipo>,
    hoy: string,
  ): Required<CambiosEquipo> {
    const fechaAdquisicion = fechaOpcional(
      datos.fechaAdquisicion,
      'La fecha de adquisición',
    );
    exigirOrden(
      fechaAdquisicion,
      hoy,
      'La fecha de adquisición no puede estar en el futuro',
    );
    return {
      marca: textoOpcional(datos.marca, 'La marca', 100),
      modelo: textoOpcional(datos.modelo, 'El modelo', 100),
      fechaAdquisicion,
      fechaProximoMantenimiento: fechaOpcional(
        datos.fechaProximoMantenimiento,
        'La fecha del próximo mantenimiento',
      ),
      observaciones: textoOpcional(
        datos.observaciones,
        'Las observaciones',
        5000,
      ),
    };
  }
}
