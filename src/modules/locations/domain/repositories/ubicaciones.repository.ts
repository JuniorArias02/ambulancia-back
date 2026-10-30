import type { Ubicacion } from '../entities/ubicacion.entity.js';

export interface FiltrosRecorrido {
  ambulanciaId?: string;
  asignacionId?: string;
  desde?: Date;
  hasta?: Date;
}

export abstract class UbicacionesRepositorio {
  /**
   * Guarda la posición y actualiza la última ubicación de la ambulancia,
   * salvo que ya tenga una más reciente (los celulares envían en desorden
   * cuando recuperan la señal).
   */
  abstract registrar(ubicacion: Ubicacion): Promise<void>;
  /** En orden cronológico, para dibujar el recorrido. */
  abstract listarRecorrido(
    filtros: FiltrosRecorrido,
    limite: number,
  ): Promise<Ubicacion[]>;
}
