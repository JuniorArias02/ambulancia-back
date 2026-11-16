import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type {
  Deambulacion,
  EstadoMental,
  NivelRiesgoCaida,
  OrigenRegistro,
} from '../catalogos_clinicos.js';

/**
 * Escala de riesgo de caídas J.H. Downton. Es opcional dentro de la historia
 * y se puede repetir (una serie, como los signos vitales). El puntaje y el
 * nivel de riesgo los calcula siempre el backend: lo que envíe el cliente
 * para esos campos no se usa.
 */

/** Lo que responde el paramédico. Todos los ítems se contestan: una valoración se registra completa. */
export interface RespuestasDownton {
  caidasPrevias: boolean;
  medTranquilizantesSedantes: boolean;
  medDiureticos: boolean;
  medHipotensores: boolean;
  medAntiparkinsonianos: boolean;
  medAntidepresivos: boolean;
  medOtros: boolean;
  deficitVisual: boolean;
  deficitAuditivo: boolean;
  deficitExtremidades: boolean;
  estadoMental: EstadoMental;
  deambulacion: Deambulacion;
}

export interface ValoracionDownton extends RespuestasDownton {
  id: string;
  historiaClinicaId: string;
  evaluadaEn: Date;
  puntajeTotal: number;
  nivelRiesgo: NivelRiesgoCaida;
  observacion: string | null;
  origen: OrigenRegistro;
  segmentoAudioId: string | null;
  confirmado: boolean;
  registradoPorId: string;
  registradoPorNombre: string | null;
  creadaEn: Date;
}

/** Puntaje >= 3 => riesgo alto. */
export const UMBRAL_RIESGO_ALTO_DOWNTON = 3;

/** Un punto por cada medicamento y por cada déficit marcado. */
const ITEMS_DE_UN_PUNTO = [
  'caidasPrevias',
  'medTranquilizantesSedantes',
  'medDiureticos',
  'medHipotensores',
  'medAntiparkinsonianos',
  'medAntidepresivos',
  'medOtros',
  'deficitVisual',
  'deficitAuditivo',
  'deficitExtremidades',
] as const satisfies readonly (keyof RespuestasDownton)[];

const PUNTOS_ESTADO_MENTAL: Readonly<Record<EstadoMental, number>> = {
  orientado: 0,
  confuso: 1,
};

/** Según la especificación del proyecto: solo `insegura` e `imposible` suman. */
const PUNTOS_DEAMBULACION: Readonly<Record<Deambulacion, number>> = {
  normal: 0,
  segura_con_ayuda: 0,
  insegura: 1,
  imposible: 1,
};

/** Máximo posible: 10 ítems de un punto + estado mental + deambulación. */
export const PUNTAJE_MAXIMO_DOWNTON = ITEMS_DE_UN_PUNTO.length + 2;

/** Hasta 60 s en el futuro, por diferencias de reloj con el celular. */
const TOLERANCIA_FUTURO_MS = 60_000;

export function calcularPuntajeDownton(respuestas: RespuestasDownton): {
  puntajeTotal: number;
  nivelRiesgo: NivelRiesgoCaida;
} {
  const puntajeTotal =
    ITEMS_DE_UN_PUNTO.filter((item) => respuestas[item]).length +
    PUNTOS_ESTADO_MENTAL[respuestas.estadoMental] +
    PUNTOS_DEAMBULACION[respuestas.deambulacion];
  return {
    puntajeTotal,
    nivelRiesgo: puntajeTotal >= UMBRAL_RIESGO_ALTO_DOWNTON ? 'alto' : 'bajo',
  };
}

export function crearValoracionDownton(datos: {
  id: string;
  historiaClinicaId: string;
  evaluadaEn: Date;
  respuestas: RespuestasDownton;
  observacion?: string | null;
  origen: OrigenRegistro;
  segmentoAudioId?: string | null;
  registradoPorId: string;
  ahora: Date;
}): ValoracionDownton {
  if (
    datos.evaluadaEn.getTime() >
    datos.ahora.getTime() + TOLERANCIA_FUTURO_MS
  ) {
    throw new ReglaNegocioError(
      'La fecha de la valoración no puede estar en el futuro',
    );
  }
  const segmentoAudioId = datos.segmentoAudioId ?? null;
  if (datos.origen === 'voz' && !segmentoAudioId) {
    throw new ReglaNegocioError(
      'Una valoración tomada de la voz debe indicar el segmento de audio',
    );
  }
  if (datos.origen === 'manual' && segmentoAudioId) {
    throw new ReglaNegocioError(
      'Una valoración manual no lleva segmento de audio',
    );
  }
  return {
    id: datos.id,
    historiaClinicaId: datos.historiaClinicaId,
    evaluadaEn: datos.evaluadaEn,
    ...datos.respuestas,
    ...calcularPuntajeDownton(datos.respuestas),
    observacion: datos.observacion?.trim() || null,
    origen: datos.origen,
    segmentoAudioId,
    // La registra el paramédico: si viene de la voz, enviarla es aceptar la propuesta.
    confirmado: true,
    registradoPorId: datos.registradoPorId,
    registradoPorNombre: null,
    creadaEn: datos.ahora,
  };
}
