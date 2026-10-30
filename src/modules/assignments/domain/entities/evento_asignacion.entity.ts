import type { NombreRol } from '../../../../common/constants/roles.js';
import type { PuntoGeografico } from '../../../../common/utils/geografia.js';
import type { EstadoAsignacion } from './asignacion.entity.js';

/**
 * Un paso del ciclo de atención: quién lo registró, cuándo y dónde. Es el
 * registro que respalda las fechas de la asignación (salidaEn, llegadaEscenaEn…).
 */
export interface EventoAsignacion {
  id: string;
  asignacionId: string;
  /** null en el despacho, el primer evento del servicio. */
  estadoAnterior: EstadoAsignacion | null;
  estadoNuevo: EstadoAsignacion;
  usuarioId: string | null;
  rolResponsable: NombreRol | null;
  ocurridoEn: Date;
  posicion: PuntoGeografico | null;
  precisionMetros: number | null;
  /** Solo en la llegada: distancia a la emergencia cuando el conductor confirmó. */
  distanciaEscenaMetros: number | null;
  /** La llegada se confirmó lejos de la emergencia, con motivo. */
  fueraDeRadio: boolean;
  observacion: string | null;
  /** Solo lectura, para mostrar. */
  responsableNombre: string | null;
}

export type DatosEventoAsignacion = Omit<
  EventoAsignacion,
  'id' | 'responsableNombre'
>;

export function crearEventoAsignacion(
  datos: Omit<
    DatosEventoAsignacion,
    | 'posicion'
    | 'precisionMetros'
    | 'distanciaEscenaMetros'
    | 'fueraDeRadio'
    | 'observacion'
  > &
    Partial<DatosEventoAsignacion>,
): EventoAsignacion {
  return {
    posicion: null,
    precisionMetros: null,
    distanciaEscenaMetros: null,
    fueraDeRadio: false,
    observacion: null,
    ...datos,
    id: crypto.randomUUID(),
    responsableNombre: null,
  };
}
