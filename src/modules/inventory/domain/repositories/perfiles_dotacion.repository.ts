import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type { PerfilDotacion } from '../entities/perfil_dotacion.entity.js';

export interface FiltrosPerfilesDotacion {
  tipoAmbulanciaId?: string;
  activo?: boolean;
  codigo?: string;
}

export abstract class PerfilesDotacionRepositorio {
  abstract buscarPorId(id: string): Promise<PerfilDotacion | null>;
  /** 1 si el código es nuevo para ese tipo; si no, la última versión + 1. */
  abstract siguienteVersion(
    tipoAmbulanciaId: string,
    codigo: string,
  ): Promise<number>;
  /** El activo del tipo (puede no estar vigente hoy). */
  abstract buscarActivoDeTipo(
    tipoAmbulanciaId: string,
  ): Promise<PerfilDotacion | null>;
  abstract listar(
    filtros: FiltrosPerfilesDotacion,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<PerfilDotacion>>;
  /** 409 si la versión ya existe (dos creaciones simultáneas). */
  abstract crear(perfil: PerfilDotacion): Promise<PerfilDotacion>;
  /** Guarda los datos y sincroniza los elementos (agregados, cambiados, quitados). */
  abstract guardar(perfil: PerfilDotacion): Promise<PerfilDotacion>;
  /** Activa este y desactiva los demás del mismo tipo, en una transacción. */
  abstract activarUnico(perfil: PerfilDotacion): Promise<PerfilDotacion>;
}
