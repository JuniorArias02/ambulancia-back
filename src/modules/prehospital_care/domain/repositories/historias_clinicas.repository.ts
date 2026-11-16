import type { HistoriaClinica } from '../entities/historia_clinica.entity.js';
import type {
  Intervencion,
  Lesion,
  SignoVital,
} from '../entities/registros_clinicos.js';
import type { ValoracionDownton } from '../entities/valoracion_downton.entity.js';
import type { FirmaHistoria } from '../entities/firma_historia.js';
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
  valoracionesDownton: ValoracionDownton[];
  firmasHistoria: FirmaHistoria[];
}

export type TipoRegistroClinico =
  'signo_vital' | 'lesion' | 'intervencion' | 'valoracion_downton';

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
  /** Mismo comportamiento que los demás registros: un id reenviado devuelve la existente. */
  abstract agregarValoracionDownton(
    valoracion: ValoracionDownton,
  ): Promise<ValoracionDownton>;
  /** De la más antigua a la más reciente. */
  abstract listarValoracionesDownton(
    historiaId: string,
  ): Promise<ValoracionDownton[]>;
  abstract buscarValoracionDownton(
    historiaId: string,
    valoracionId: string,
  ): Promise<ValoracionDownton | null>;
  /** true si el segmento es de una grabación de esa historia. */
  abstract segmentoAudioDeHistoria(
    segmentoAudioId: string,
    historiaId: string,
  ): Promise<boolean>;
  /**
   * Un id reenviado devuelve la existente. Si ya hay otra firma del mismo
   * rol y propósito en la historia, falla con 409.
   */
  abstract agregarFirmaHistoria(firma: FirmaHistoria): Promise<FirmaHistoria>;
  abstract buscarFirmaHistoria(
    historiaId: string,
    firmaId: string,
  ): Promise<FirmaHistoria | null>;
  /** false si no existía en esa historia. */
  abstract eliminarFirmaHistoria(
    historiaId: string,
    firmaId: string,
  ): Promise<boolean>;
  /** false si no existía en esa historia. */
  abstract eliminarRegistro(
    tipo: TipoRegistroClinico,
    historiaId: string,
    registroId: string,
  ): Promise<boolean>;
}
