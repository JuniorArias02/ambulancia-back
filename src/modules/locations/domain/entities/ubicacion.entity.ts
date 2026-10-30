/** Una posición GPS reportada por el celular de la tripulación. */
export interface Ubicacion {
  id: string;
  ambulanciaId: string;
  /** Servicio en curso cuando se reportó; null si la ambulancia estaba libre. */
  asignacionId: string | null;
  latitud: number;
  longitud: number;
  /** km/h, si el celular la reporta. */
  velocidad: number | null;
  registradaEn: Date;
}
