import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import { diaColombia } from '../../../../common/utils/fecha_colombia.js';
import type { ItemListaChequeo, ListaChequeo } from './lista_chequeo.entity.js';

export const ESTADOS_CHEQUEO = ['borrador', 'finalizado'] as const;
export type EstadoChequeo = (typeof ESTADOS_CHEQUEO)[number];

export const LONGITUD_MAXIMA_OBSERVACION = 1000;

export interface RespuestaChequeo {
  id: string;
  itemId: string;
  estadoId: string;
  tieneObservacion: boolean;
  observacion: string | null;
  respondidoEn: Date;
}

export interface DatosRespuesta {
  itemId: string;
  estadoId: string;
  tieneObservacion: boolean;
  observacion?: string | null;
}

export interface PropiedadesChequeoDiario {
  id: string;
  listaChequeoId: string;
  conductorId: string;
  ambulanciaId: string;
  /** "AAAA-MM-DD", día de Colombia. */
  fecha: string;
  iniciadoEn: Date | null;
  finalizadoEn: Date | null;
  estado: EstadoChequeo;
  respuestas: RespuestaChequeo[];
  /** Solo lectura, para mostrar. */
  conductorNombre: string | null;
  ambulanciaCodigo: string | null;
}

/**
 * El formulario diligenciado por un conductor para una ambulancia en un día.
 * Se responde por partes en `borrador` y, al finalizar, ya no cambia.
 */
export class ChequeoDiario {
  private constructor(private readonly propiedades: PropiedadesChequeoDiario) {}

  /** "2026-11-10" con el día de Colombia, no el del servidor (UTC). */
  static fechaDelDia(ahora: Date): string {
    const dia = diaColombia(ahora);
    return `${dia.slice(0, 4)}-${dia.slice(4, 6)}-${dia.slice(6, 8)}`;
  }

  static iniciar(datos: {
    listaChequeoId: string;
    conductorId: string;
    ambulanciaId: string;
    ahora: Date;
  }): ChequeoDiario {
    return new ChequeoDiario({
      id: crypto.randomUUID(),
      listaChequeoId: datos.listaChequeoId,
      conductorId: datos.conductorId,
      ambulanciaId: datos.ambulanciaId,
      fecha: ChequeoDiario.fechaDelDia(datos.ahora),
      iniciadoEn: datos.ahora,
      finalizadoEn: null,
      estado: 'borrador',
      respuestas: [],
      conductorNombre: null,
      ambulanciaCodigo: null,
    });
  }

  static reconstruir(propiedades: PropiedadesChequeoDiario): ChequeoDiario {
    return new ChequeoDiario({
      ...propiedades,
      respuestas: propiedades.respuestas.map((r) => ({ ...r })),
    });
  }

  get id(): string {
    return this.propiedades.id;
  }
  get listaChequeoId(): string {
    return this.propiedades.listaChequeoId;
  }
  get conductorId(): string {
    return this.propiedades.conductorId;
  }
  get ambulanciaId(): string {
    return this.propiedades.ambulanciaId;
  }
  get fecha(): string {
    return this.propiedades.fecha;
  }
  get iniciadoEn(): Date | null {
    return this.propiedades.iniciadoEn;
  }
  get finalizadoEn(): Date | null {
    return this.propiedades.finalizadoEn;
  }
  get estado(): EstadoChequeo {
    return this.propiedades.estado;
  }
  get respuestas(): readonly RespuestaChequeo[] {
    return this.propiedades.respuestas;
  }
  get conductorNombre(): string | null {
    return this.propiedades.conductorNombre;
  }
  get ambulanciaCodigo(): string | null {
    return this.propiedades.ambulanciaCodigo;
  }

  estaFinalizado(): boolean {
    return this.propiedades.estado === 'finalizado';
  }

  /** Agrega la respuesta o reemplaza la que ya tenía ese ítem. */
  responder(
    lista: ListaChequeo,
    datos: DatosRespuesta,
    ahora: Date,
  ): RespuestaChequeo {
    this.exigirBorrador();
    this.exigirMismaLista(lista);

    const item = lista.buscarItem(datos.itemId);
    if (!item?.activo) {
      throw new ReglaNegocioError(
        'La pregunta no pertenece a esta lista de chequeo',
      );
    }
    const estado = lista.buscarEstado(datos.estadoId);
    if (!estado?.activo) {
      throw new ReglaNegocioError(
        `La calificación no es válida para "${item.pregunta}"`,
      );
    }

    const observacion = ChequeoDiario.observacion(item, datos);
    const anterior = this.propiedades.respuestas.find(
      (r) => r.itemId === item.id,
    );
    const respuesta: RespuestaChequeo = {
      id: anterior?.id ?? crypto.randomUUID(),
      itemId: item.id,
      estadoId: estado.id,
      tieneObservacion: observacion !== null,
      observacion,
      respondidoEn: ahora,
    };
    this.propiedades.respuestas = [
      ...this.propiedades.respuestas.filter((r) => r.itemId !== item.id),
      respuesta,
    ];
    return respuesta;
  }

  /** Preguntas obligatorias activas que todavía no tienen respuesta. */
  pendientes(lista: ListaChequeo): ItemListaChequeo[] {
    const respondidas = new Set(
      this.propiedades.respuestas.map((r) => r.itemId),
    );
    return lista
      .itemsActivos()
      .filter((i) => i.obligatorio && !respondidas.has(i.id));
  }

  finalizar(lista: ListaChequeo, ahora: Date): void {
    this.exigirBorrador();
    this.exigirMismaLista(lista);
    const pendientes = this.pendientes(lista);
    if (pendientes.length > 0) {
      throw new ReglaNegocioError(
        `Faltan por responder: ${pendientes.map((i) => i.pregunta).join(' · ')}`,
      );
    }
    this.propiedades.estado = 'finalizado';
    this.propiedades.finalizadoEn = ahora;
  }

  private exigirBorrador(): void {
    if (this.estaFinalizado()) {
      throw new ReglaNegocioError(
        'El chequeo de hoy ya fue finalizado y no se puede modificar',
      );
    }
  }

  private exigirMismaLista(lista: ListaChequeo): void {
    if (lista.id !== this.propiedades.listaChequeoId) {
      throw new ReglaNegocioError('La lista no corresponde a este chequeo');
    }
  }

  /** `tieneObservacion: false` descarta el texto; `true` lo exige. */
  private static observacion(
    item: ItemListaChequeo,
    datos: DatosRespuesta,
  ): string | null {
    if (!datos.tieneObservacion) return null;
    if (!item.permiteObservacion) {
      throw new ReglaNegocioError(`"${item.pregunta}" no admite observaciones`);
    }
    const texto = datos.observacion?.trim();
    if (!texto) {
      throw new ReglaNegocioError(
        `Escriba la observación de "${item.pregunta}"`,
      );
    }
    if (texto.length > LONGITUD_MAXIMA_OBSERVACION) {
      throw new ReglaNegocioError(
        `La observación admite máximo ${LONGITUD_MAXIMA_OBSERVACION} caracteres`,
      );
    }
    return texto;
  }
}
