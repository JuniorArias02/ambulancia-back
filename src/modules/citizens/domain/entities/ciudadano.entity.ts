import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import { normalizarNumeroDocumento } from '../../../../common/utils/documento_identidad.js';
import { diaColombia } from '../../../../common/utils/fecha_colombia.js';
import type { VerificacionIdentidad } from './verificacion_identidad.entity.js';

/**
 * Documentos de adultos: la Ley 1581 da un tratamiento especial a los datos
 * de menores, así que esta versión no registra menores de edad.
 */
export const TIPOS_DOCUMENTO_CIUDADANO = [
  'CC',
  'CE',
  'PPT',
  'PEP',
  'PA',
] as const;
export type TipoDocumentoCiudadano = (typeof TIPOS_DOCUMENTO_CIUDADANO)[number];

export const EDAD_MINIMA_CIUDADANO = 18;
const EDAD_MAXIMA_RAZONABLE = 120;
const PATRON_DOCUMENTO = /^[A-Z0-9]{4,20}$/;
const PATRON_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

export type EstadoCuenta = 'activo' | 'inactivo' | 'bloqueado';

export interface DatosIdentidad {
  nombres: string;
  apellidos: string;
  tipoDocumento: TipoDocumentoCiudadano;
  numeroDocumento: string;
  /** Fecha de calendario `AAAA-MM-DD`, sin hora ni zona. */
  fechaNacimiento: string;
}

export interface PropiedadesCiudadano extends DatosIdentidad {
  id: string;
  correo: string;
  telefono: string;
  estadoCuenta: EstadoCuenta;
  creadoEn: Date;
  verificacion: VerificacionIdentidad;
}

export class Ciudadano {
  private constructor(private readonly propiedades: PropiedadesCiudadano) {}

  /** `hoy` llega de fuera para poder probar la regla de edad. */
  static registrar(
    datos: DatosIdentidad & {
      id: string;
      correo: string;
      telefono: string;
      verificacion: VerificacionIdentidad;
    },
    hoy: Date,
  ): Ciudadano {
    return new Ciudadano({
      ...Ciudadano.validarIdentidad(datos, hoy),
      id: datos.id,
      correo: Ciudadano.normalizarCorreo(datos.correo),
      telefono: datos.telefono.trim(),
      estadoCuenta: 'activo',
      creadoEn: hoy,
      verificacion: datos.verificacion,
    });
  }

  static reconstruir(propiedades: PropiedadesCiudadano): Ciudadano {
    return new Ciudadano({ ...propiedades });
  }

  static normalizarCorreo(correo: string): string {
    return correo.trim().toLowerCase();
  }

  /** "1.090.123-456" y "1090123456" son el mismo documento. */
  static normalizarDocumento(numero: string): string {
    const normalizado = normalizarNumeroDocumento(numero);
    if (!PATRON_DOCUMENTO.test(normalizado)) {
      throw new ReglaNegocioError(
        'El número de documento debe tener entre 4 y 20 letras o números',
      );
    }
    return normalizado;
  }

  /** Normaliza y valida; el registro la usa antes de guardar cualquier archivo. */
  static validarIdentidad(datos: DatosIdentidad, hoy: Date): DatosIdentidad {
    const nombres = datos.nombres.trim();
    const apellidos = datos.apellidos.trim();
    if (!nombres || !apellidos) {
      throw new ReglaNegocioError(
        'Los nombres y los apellidos son obligatorios',
      );
    }
    Ciudadano.validarFechaNacimiento(datos.fechaNacimiento, hoy);
    return {
      nombres,
      apellidos,
      tipoDocumento: datos.tipoDocumento,
      numeroDocumento: Ciudadano.normalizarDocumento(datos.numeroDocumento),
      fechaNacimiento: datos.fechaNacimiento,
    };
  }

  private static validarFechaNacimiento(fecha: string, hoy: Date): void {
    const partes = PATRON_FECHA.exec(fecha);
    const anio = Number(partes?.[1]);
    const mes = Number(partes?.[2]);
    const dia = Number(partes?.[3]);
    const calendario = new Date(Date.UTC(anio, mes - 1, dia));
    if (
      !partes ||
      calendario.getUTCFullYear() !== anio ||
      calendario.getUTCMonth() !== mes - 1 ||
      calendario.getUTCDate() !== dia
    ) {
      throw new ReglaNegocioError('La fecha de nacimiento no es válida');
    }

    // La edad se cuenta con el día de Colombia, no con el del servidor.
    const hoyColombia = diaColombia(hoy);
    const anioHoy = Number(hoyColombia.slice(0, 4));
    const mesDiaHoy = hoyColombia.slice(4);
    const mesDia = `${partes[2]}${partes[3]}`;
    const edad = anioHoy - anio - (mesDia > mesDiaHoy ? 1 : 0);
    if (edad < 0 || edad > EDAD_MAXIMA_RAZONABLE) {
      throw new ReglaNegocioError('La fecha de nacimiento no es válida');
    }
    if (edad < EDAD_MINIMA_CIUDADANO) {
      throw new ReglaNegocioError(
        `Debe ser mayor de ${EDAD_MINIMA_CIUDADANO} años para registrarse`,
      );
    }
  }

  get id(): string {
    return this.propiedades.id;
  }
  get nombres(): string {
    return this.propiedades.nombres;
  }
  get apellidos(): string {
    return this.propiedades.apellidos;
  }
  get nombreCompleto(): string {
    return `${this.propiedades.nombres} ${this.propiedades.apellidos}`;
  }
  get tipoDocumento(): TipoDocumentoCiudadano {
    return this.propiedades.tipoDocumento;
  }
  get numeroDocumento(): string {
    return this.propiedades.numeroDocumento;
  }
  get fechaNacimiento(): string {
    return this.propiedades.fechaNacimiento;
  }
  get correo(): string {
    return this.propiedades.correo;
  }
  get telefono(): string {
    return this.propiedades.telefono;
  }
  get estadoCuenta(): EstadoCuenta {
    return this.propiedades.estadoCuenta;
  }
  get creadoEn(): Date {
    return this.propiedades.creadoEn;
  }
  get verificacion(): VerificacionIdentidad {
    return this.propiedades.verificacion;
  }

  /** Para mostrárselo al propio ciudadano sin repetir el número completo. */
  documentoEnmascarado(): string {
    const numero = this.propiedades.numeroDocumento;
    return `${'•'.repeat(Math.max(numero.length - 4, 0))}${numero.slice(-4)}`;
  }

  actualizarContacto(datos: { correo?: string; telefono?: string }): void {
    if (datos.correo !== undefined) {
      this.propiedades.correo = Ciudadano.normalizarCorreo(datos.correo);
    }
    if (datos.telefono !== undefined) {
      this.propiedades.telefono = datos.telefono.trim();
    }
  }

  /**
   * Los datos de identidad solo cambian dentro de una corrección pedida por
   * el administrador: así nadie cambia su documento y conserva la verificación.
   */
  corregirIdentidad(datos: Partial<DatosIdentidad>, hoy: Date): void {
    if (!this.propiedades.verificacion.permiteReenviar()) {
      throw new ReglaNegocioError(
        'Los datos de identidad solo se corrigen cuando el administrador lo solicita',
      );
    }
    const corregida = Ciudadano.validarIdentidad(
      {
        nombres: datos.nombres ?? this.propiedades.nombres,
        apellidos: datos.apellidos ?? this.propiedades.apellidos,
        tipoDocumento: datos.tipoDocumento ?? this.propiedades.tipoDocumento,
        numeroDocumento:
          datos.numeroDocumento ?? this.propiedades.numeroDocumento,
        fechaNacimiento:
          datos.fechaNacimiento ?? this.propiedades.fechaNacimiento,
      },
      hoy,
    );
    Object.assign(this.propiedades, corregida);
  }
}
