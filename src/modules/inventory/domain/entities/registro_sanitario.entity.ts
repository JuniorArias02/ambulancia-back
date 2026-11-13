import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import { fusionarDefinidos } from '../../../../common/utils/objetos.js';
import {
  exigirOrden,
  fechaOpcional,
  textoObligatorio,
  textoOpcional,
} from '../services/validaciones.js';
import type { Insumo } from './insumo.entity.js';

export const TIPOS_REGISTRO_SANITARIO = [
  'registro_sanitario',
  'permiso_comercializacion',
  'notificacion_sanitaria',
  'otro',
] as const;
export type TipoRegistroSanitario = (typeof TIPOS_REGISTRO_SANITARIO)[number];

export const ESTADOS_REGISTRO_SANITARIO = [
  'vigente',
  'vencido',
  'suspendido',
  'cancelado',
] as const;
export type EstadoRegistroSanitario =
  (typeof ESTADOS_REGISTRO_SANITARIO)[number];

export interface DatosRegistroSanitario {
  numeroRegistro: string;
  tipoRegistro: TipoRegistroSanitario;
  fechaExpedicion: string | null;
  fechaVencimiento: string | null;
  titular: string | null;
  documentoUrl: string | null;
  estado: EstadoRegistroSanitario;
}

export interface PropiedadesRegistroSanitario extends DatosRegistroSanitario {
  id: string;
  insumoId: string;
  creadoEn: Date;
  actualizadoEn: Date;
  /** Solo lectura, para mostrar. */
  insumoNombre: string | null;
}

/** Registro INVIMA (u otro permiso) que respalda un insumo. */
export class RegistroSanitario {
  private constructor(
    private readonly propiedades: PropiedadesRegistroSanitario,
  ) {}

  static crear(
    insumo: Insumo,
    datos: DatosRegistroSanitario,
    ahora: Date,
  ): RegistroSanitario {
    return new RegistroSanitario({
      ...RegistroSanitario.validar(datos),
      id: crypto.randomUUID(),
      insumoId: insumo.id,
      creadoEn: ahora,
      actualizadoEn: ahora,
      insumoNombre: insumo.nombre,
    });
  }

  static reconstruir(
    propiedades: PropiedadesRegistroSanitario,
  ): RegistroSanitario {
    return new RegistroSanitario({ ...propiedades });
  }

  get id(): string {
    return this.propiedades.id;
  }
  get insumoId(): string {
    return this.propiedades.insumoId;
  }
  get numeroRegistro(): string {
    return this.propiedades.numeroRegistro;
  }
  get tipoRegistro(): TipoRegistroSanitario {
    return this.propiedades.tipoRegistro;
  }
  get fechaExpedicion(): string | null {
    return this.propiedades.fechaExpedicion;
  }
  get fechaVencimiento(): string | null {
    return this.propiedades.fechaVencimiento;
  }
  get titular(): string | null {
    return this.propiedades.titular;
  }
  get documentoUrl(): string | null {
    return this.propiedades.documentoUrl;
  }
  get estado(): EstadoRegistroSanitario {
    return this.propiedades.estado;
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

  /** Vigente por estado y por fecha: un "vigente" con fecha pasada ya no sirve. */
  estaVigente(hoy: string): boolean {
    const { estado, fechaVencimiento } = this.propiedades;
    return (
      estado === 'vigente' &&
      (fechaVencimiento === null || fechaVencimiento >= hoy)
    );
  }

  actualizar(cambios: Partial<DatosRegistroSanitario>, ahora: Date): void {
    const actual: DatosRegistroSanitario = {
      numeroRegistro: this.propiedades.numeroRegistro,
      tipoRegistro: this.propiedades.tipoRegistro,
      fechaExpedicion: this.propiedades.fechaExpedicion,
      fechaVencimiento: this.propiedades.fechaVencimiento,
      titular: this.propiedades.titular,
      documentoUrl: this.propiedades.documentoUrl,
      estado: this.propiedades.estado,
    };
    Object.assign(
      this.propiedades,
      RegistroSanitario.validar(fusionarDefinidos(actual, cambios)),
      { actualizadoEn: ahora },
    );
  }

  /** Lotes y equipos de un insumo que lo exige deben traer uno vigente y propio. */
  static exigirParaInsumo(
    insumo: Insumo,
    registro: RegistroSanitario | null,
    hoy: string,
  ): void {
    if (registro && registro.insumoId !== insumo.id) {
      throw new ReglaNegocioError(
        `El registro sanitario no pertenece a "${insumo.nombre}"`,
      );
    }
    if (!insumo.requiereRegistroSanitario) return;
    if (!registro) {
      throw new ReglaNegocioError(
        `"${insumo.nombre}" exige registro sanitario`,
      );
    }
    if (!registro.estaVigente(hoy)) {
      throw new ReglaNegocioError(
        `El registro sanitario ${registro.numeroRegistro} no está vigente`,
      );
    }
  }

  private static validar(
    datos: DatosRegistroSanitario,
  ): DatosRegistroSanitario {
    const fechaExpedicion = fechaOpcional(
      datos.fechaExpedicion,
      'La fecha de expedición',
    );
    const fechaVencimiento = fechaOpcional(
      datos.fechaVencimiento,
      'La fecha de vencimiento',
    );
    exigirOrden(
      fechaExpedicion,
      fechaVencimiento,
      'El registro no puede vencer antes de su expedición',
    );
    return {
      ...datos,
      numeroRegistro: textoObligatorio(
        datos.numeroRegistro,
        'El número de registro',
        100,
      ),
      fechaExpedicion,
      fechaVencimiento,
      titular: textoOpcional(datos.titular, 'El titular', 150),
      documentoUrl: textoOpcional(datos.documentoUrl, 'El documento', 500),
    };
  }
}
