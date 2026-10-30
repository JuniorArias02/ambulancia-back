import {
  type NombreRol,
  esRolValido,
} from '../../../../common/constants/roles.js';
import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';

export const ESTADOS_USUARIO = ['activo', 'inactivo', 'bloqueado'] as const;
export type EstadoUsuario = (typeof ESTADOS_USUARIO)[number];

export interface PropiedadesUsuario {
  id: string;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string | null;
  contrasenaHash: string;
  estado: EstadoUsuario;
  rol: NombreRol;
  ultimoAcceso: Date | null;
  creadoEn: Date;
}

export interface DatosNuevoUsuario {
  nombres: string;
  apellidos: string;
  correo: string;
  telefono?: string | null;
  contrasenaHash: string;
  rol: string;
}

export interface DatosPersonalesUsuario {
  nombres?: string;
  apellidos?: string;
  telefono?: string | null;
}

export class Usuario {
  private constructor(private readonly propiedades: PropiedadesUsuario) {}

  static crear(datos: DatosNuevoUsuario): Usuario {
    return new Usuario({
      id: crypto.randomUUID(),
      nombres: datos.nombres.trim(),
      apellidos: datos.apellidos.trim(),
      correo: Usuario.normalizarCorreo(datos.correo),
      telefono: datos.telefono?.trim() || null,
      contrasenaHash: datos.contrasenaHash,
      estado: 'activo',
      rol: Usuario.validarRol(datos.rol),
      ultimoAcceso: null,
      creadoEn: new Date(),
    });
  }

  static reconstruir(propiedades: PropiedadesUsuario): Usuario {
    return new Usuario({ ...propiedades });
  }

  static normalizarCorreo(correo: string): string {
    return correo.trim().toLowerCase();
  }

  static esEstadoValido(estado: string): estado is EstadoUsuario {
    return ESTADOS_USUARIO.some((valido) => valido === estado);
  }

  private static validarRol(rol: string): NombreRol {
    const normalizado = rol.trim();
    if (!esRolValido(normalizado)) {
      throw new ReglaNegocioError(`Rol inexistente: ${normalizado}`);
    }
    return normalizado;
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
  get correo(): string {
    return this.propiedades.correo;
  }
  get telefono(): string | null {
    return this.propiedades.telefono;
  }
  get contrasenaHash(): string {
    return this.propiedades.contrasenaHash;
  }
  get estado(): EstadoUsuario {
    return this.propiedades.estado;
  }
  get rol(): NombreRol {
    return this.propiedades.rol;
  }
  get ultimoAcceso(): Date | null {
    return this.propiedades.ultimoAcceso;
  }
  get creadoEn(): Date {
    return this.propiedades.creadoEn;
  }

  estaActivo(): boolean {
    return this.propiedades.estado === 'activo';
  }

  tieneRol(rol: NombreRol): boolean {
    return this.propiedades.rol === rol;
  }

  actualizarDatosPersonales(datos: DatosPersonalesUsuario): void {
    if (datos.nombres !== undefined) {
      this.propiedades.nombres = datos.nombres.trim();
    }
    if (datos.apellidos !== undefined) {
      this.propiedades.apellidos = datos.apellidos.trim();
    }
    if (datos.telefono !== undefined) {
      this.propiedades.telefono = datos.telefono?.trim() || null;
    }
  }

  cambiarEstado(estado: EstadoUsuario): void {
    if (this.propiedades.estado === estado) {
      throw new ReglaNegocioError(`El usuario ya se encuentra ${estado}`);
    }
    this.propiedades.estado = estado;
  }

  asignarRol(rol: string): void {
    this.propiedades.rol = Usuario.validarRol(rol);
  }

  cambiarContrasena(contrasenaHash: string): void {
    this.propiedades.contrasenaHash = contrasenaHash;
  }
}
