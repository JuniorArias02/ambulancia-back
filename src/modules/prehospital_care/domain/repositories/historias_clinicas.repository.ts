import type { HistoriaClinica } from '../entities/historia_clinica.entity.js';
import type {
  Intervencion,
  Lesion,
  SignoVital,
} from '../entities/registros_clinicos.js';
import type { EstadoHistoria } from '../catalogos_clinicos.js';

export interface FiltrosHistorias {
  asignacionId?: string;
  emergenciaId?: string;
}

/** La historia con todos sus registros, para la pantalla de detalle y para la huella del cierre. */
export interface DetalleHistoria {
  historia: HistoriaClinica;
  signosVitales: SignoVital[];
  lesiones: Lesion[];
  intervenciones: Intervencion[];
}

export type TipoRegistroClinico = 'signo_vital' | 'lesion' | 'intervencion';

/** Otra solicitud tomó el mismo número de historia: el caso de uso reintenta. */
export class NumeroHistoriaEnUsoError extends Error {}

export abstract class HistoriasClinicasRepositorio {
  abstract buscarPorId(id: string): Promise<HistoriaClinica | null>;
  abstract buscarDetalle(id: string): Promise<DetalleHistoria | null>;
  abstract listar(filtros: FiltrosHistorias): Promise<HistoriaClinica[]>;
  abstract ultimoConsecutivo(prefijo: string): Promise<number>;
  /** Lanza `NumeroHistoriaEnUsoError` si el número ya existe. */
  abstract crear(historia: HistoriaClinica): Promise<HistoriaClinica>;
  /** Falla con 409 si el estado en la base ya no es `estadoEsperado`. */
  abstract actualizar(
    historia: HistoriaClinica,
    estadoEsperado: EstadoHistoria,
  ): Promise<HistoriaClinica>;
  abstract contarSignosVitales(historiaId: string): Promise<number>;
  /** Los registros llegan con id del celular: si ya existe en esa historia, se devuelve el existente. */
  abstract agregarSignoVital(signo: SignoVital): Promise<SignoVital>;
  abstract agregarLesion(lesion: Lesion): Promise<Lesion>;
  abstract agregarIntervencion(
    intervencion: Intervencion,
  ): Promise<Intervencion>;
  /** false si no existía en esa historia. */
  abstract eliminarRegistro(
    tipo: TipoRegistroClinico,
    historiaId: string,
    registroId: string,
  ): Promise<boolean>;
}
