import type {
  Paginacion,
  ResultadoPaginado,
} from '../../src/common/types/resultado_paginado.js';
import type { EventoAuditoria } from '../../src/modules/audit/domain/entities/evento_auditoria.entity.js';
import { AuditoriaRepositorio } from '../../src/modules/audit/domain/repositories/auditoria.repository.js';
import type { Sesion } from '../../src/modules/authentication/domain/entities/sesion.entity.js';
import { SesionesRepositorio } from '../../src/modules/authentication/domain/repositories/sesiones.repository.js';
import {
  type ContenidoToken,
  EmisorTokens,
  type TokenEmitido,
} from '../../src/modules/authentication/domain/services/emisor_tokens.service.js';
import type { Rol } from '../../src/modules/users/domain/entities/rol.entity.js';
import { Usuario } from '../../src/modules/users/domain/entities/usuario.entity.js';
import { RolesRepositorio } from '../../src/modules/users/domain/repositories/roles.repository.js';
import {
  type FiltrosUsuarios,
  UsuariosRepositorio,
} from '../../src/modules/users/domain/repositories/usuarios.repository.js';
import { HashContrasena } from '../../src/modules/users/domain/services/hash_contrasena.service.js';

export class UsuariosMemoria extends UsuariosRepositorio {
  readonly usuarios = new Map<string, Usuario>();

  buscarPorId(id: string): Promise<Usuario | null> {
    return Promise.resolve(this.usuarios.get(id) ?? null);
  }

  buscarPorCorreo(correo: string): Promise<Usuario | null> {
    const usuario = [...this.usuarios.values()].find(
      (u) => u.correo === correo,
    );
    return Promise.resolve(usuario ?? null);
  }

  async existeCorreo(correo: string): Promise<boolean> {
    return (await this.buscarPorCorreo(correo)) !== null;
  }

  listar(
    _filtros: FiltrosUsuarios,
    { pagina, limite }: Paginacion,
  ): Promise<ResultadoPaginado<Usuario>> {
    const datos = [...this.usuarios.values()];
    return Promise.resolve({ datos, total: datos.length, pagina, limite });
  }

  crear(usuario: Usuario): Promise<Usuario> {
    this.usuarios.set(usuario.id, usuario);
    return Promise.resolve(usuario);
  }

  actualizar(usuario: Usuario): Promise<Usuario> {
    this.usuarios.set(usuario.id, usuario);
    return Promise.resolve(usuario);
  }

  registrarAcceso(): Promise<void> {
    return Promise.resolve();
  }
}

export class RolesMemoria extends RolesRepositorio {
  constructor(private readonly roles: Rol[]) {
    super();
  }

  listar(): Promise<Rol[]> {
    return Promise.resolve([...this.roles]);
  }
}

export class SesionesMemoria extends SesionesRepositorio {
  readonly sesiones = new Map<string, Sesion>();
  readonly revocadas = new Set<string>();

  guardar(sesion: Sesion): Promise<void> {
    this.sesiones.set(sesion.id, sesion);
    return Promise.resolve();
  }

  buscarPorId(id: string): Promise<Sesion | null> {
    return Promise.resolve(this.sesiones.get(id) ?? null);
  }

  revocar(id: string): Promise<void> {
    this.revocadas.add(id);
    return Promise.resolve();
  }

  revocarTodasDelUsuario(usuarioId: string): Promise<void> {
    for (const sesion of this.sesiones.values()) {
      if (sesion.usuarioId === usuarioId) this.revocadas.add(sesion.id);
    }
    return Promise.resolve();
  }
}

/** Hash reversible solo para pruebas: evita el costo de Argon2. */
export class HashFalso extends HashContrasena {
  generar(contrasena: string): Promise<string> {
    return Promise.resolve(`hash:${contrasena}`);
  }

  verificar(hash: string, contrasena: string): Promise<boolean> {
    return Promise.resolve(hash === `hash:${contrasena}`);
  }
}

export class EmisorTokensFalso extends EmisorTokens {
  emitir({ usuarioId, sesionId }: ContenidoToken): Promise<TokenEmitido> {
    return Promise.resolve({
      token: `token-${usuarioId}-${sesionId}`,
      tokenHash: `huella-${sesionId}`,
      expiraEn: new Date(Date.now() + 3_600_000),
    });
  }
}

export class AuditoriaMemoria extends AuditoriaRepositorio {
  readonly eventos: EventoAuditoria[] = [];

  registrar(evento: EventoAuditoria): Promise<void> {
    this.eventos.push(evento);
    return Promise.resolve();
  }
}

export const ROLES_PRUEBA: Rol[] = [
  { id: 'r1', nombre: 'administrador', descripcion: null },
  { id: 'r2', nombre: 'despachador', descripcion: null },
  { id: 'r3', nombre: 'paramedico', descripcion: null },
  { id: 'r4', nombre: 'conductor', descripcion: null },
];

export function crearUsuarioPrueba(
  cambios: Partial<{
    correo: string;
    rol: string;
    contrasena: string;
  }> = {},
): Usuario {
  return Usuario.crear({
    nombres: 'Laura',
    apellidos: 'Gómez',
    correo: cambios.correo ?? 'laura@galenos.co',
    contrasenaHash: `hash:${cambios.contrasena ?? 'Secreta2026'}`,
    rol: cambios.rol ?? 'despachador',
  });
}
