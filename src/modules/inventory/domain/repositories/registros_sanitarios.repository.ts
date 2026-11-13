import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type {
  EstadoRegistroSanitario,
  RegistroSanitario,
} from '../entities/registro_sanitario.entity.js';

export interface FiltrosRegistrosSanitarios {
  insumoId?: string;
  estado?: EstadoRegistroSanitario;
  /** "AAAA-MM-DD": los que vencen hasta esa fecha (inclusive). */
  vencenHasta?: string;
}

export abstract class RegistrosSanitariosRepositorio {
  abstract buscarPorId(id: string): Promise<RegistroSanitario | null>;
  abstract existeNumero(
    insumoId: string,
    numeroRegistro: string,
    excluirId?: string,
  ): Promise<boolean>;
  abstract listar(
    filtros: FiltrosRegistrosSanitarios,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<RegistroSanitario>>;
  abstract crear(registro: RegistroSanitario): Promise<RegistroSanitario>;
  abstract actualizar(registro: RegistroSanitario): Promise<RegistroSanitario>;
}
