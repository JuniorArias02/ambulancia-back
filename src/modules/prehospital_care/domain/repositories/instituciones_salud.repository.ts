import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type {
  InstitucionSalud,
  NivelComplejidad,
} from '../entities/institucion_salud.entity.js';

export interface FiltrosInstituciones {
  busqueda?: string;
  activa?: boolean;
  nivelComplejidad?: NivelComplejidad;
}

export abstract class InstitucionesSaludRepositorio {
  abstract buscarPorId(id: string): Promise<InstitucionSalud | null>;
  abstract existeCodigoHabilitacion(
    codigo: string,
    excluirId?: string,
  ): Promise<boolean>;
  abstract listar(
    filtros: FiltrosInstituciones,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<InstitucionSalud>>;
  /** Todas las que cumplen los filtros (para ordenar por cercanía). */
  abstract listarTodas(
    filtros: FiltrosInstituciones,
  ): Promise<InstitucionSalud[]>;
  abstract crear(institucion: InstitucionSalud): Promise<InstitucionSalud>;
  abstract actualizar(institucion: InstitucionSalud): Promise<InstitucionSalud>;
}
