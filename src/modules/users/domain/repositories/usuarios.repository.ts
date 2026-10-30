import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type { NombreRol } from '../../../../common/constants/roles.js';
import type { EstadoUsuario, Usuario } from '../entities/usuario.entity.js';

export interface FiltrosUsuarios {
  busqueda?: string;
  estado?: EstadoUsuario;
  rol?: NombreRol;
}

export abstract class UsuariosRepositorio {
  abstract buscarPorId(id: string): Promise<Usuario | null>;
  abstract buscarPorCorreo(correo: string): Promise<Usuario | null>;
  abstract existeCorreo(correo: string): Promise<boolean>;
  abstract listar(
    filtros: FiltrosUsuarios,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<Usuario>>;
  abstract crear(usuario: Usuario): Promise<Usuario>;
  /** Persiste datos personales, estado, contraseña y rol del usuario. */
  abstract actualizar(usuario: Usuario): Promise<Usuario>;
  abstract registrarAcceso(usuarioId: string, fecha: Date): Promise<void>;
}
