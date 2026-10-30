import type { AmbulanciaRespuestaDto } from '../../../ambulances/presentation/dto/ambulancia_respuesta.dto.js';
import type { TurnoRespuestaDto } from '../../../ambulances/presentation/dto/turno_respuesta.dto.js';
import type {
  AsignacionRespuestaDto,
  MiServicioRespuestaDto,
} from '../../../assignments/presentation/dto/asignacion_respuesta.dto.js';
import type {
  EmergenciaRespuestaDto,
  PosibleDuplicadaRespuestaDto,
} from '../../../emergencies/presentation/dto/emergencia_respuesta.dto.js';
import type { RutaRespuestaDto } from '../../../routing/presentation/dto/ruta_respuesta.dto.js';

export interface UbicacionTiempoRealDto {
  ambulanciaId: string;
  asignacionId: string | null;
  latitud: number;
  longitud: number;
  velocidad: number | null;
  registradaEn: Date;
}

export interface PosibleDuplicadoTiempoRealDto {
  emergenciaId: string;
  numeroEmergencia: string;
  posibles: PosibleDuplicadaRespuestaDto[];
}

/**
 * Datos de cada evento de negocio. Se reutilizan los DTO del REST para que
 * los clientes reciban la misma forma que ya conocen.
 */
export interface DatosEventosServidor {
  'emergencia.creada': { emergencia: EmergenciaRespuestaDto };
  'emergencia.actualizada': {
    emergencia: EmergenciaRespuestaDto;
    cambios: readonly string[];
  };
  'emergencia.posible_duplicado': PosibleDuplicadoTiempoRealDto;
  'asignacion.creada': { asignacion: AsignacionRespuestaDto };
  'asignacion.actualizada': { asignacion: AsignacionRespuestaDto };
  'asignacion.ruta_actualizada': { ruta: RutaRespuestaDto };
  'ambulancia.actualizada': { ambulancia: AmbulanciaRespuestaDto };
  'ambulancia.ubicacion_actualizada': UbicacionTiempoRealDto;
  'turno.actualizado': { turno: TurnoRespuestaDto };
  'mi_servicio.actualizado': MiServicioRespuestaDto;
}

export type EventoServidor = keyof DatosEventosServidor;

/** Sobre común: el `id` permite al cliente descartar eventos repetidos. */
export interface EventoTiempoReal<E extends EventoServidor = EventoServidor> {
  id: string;
  tipo: E;
  /** ISO 8601. */
  ocurridoEn: string;
  datos: DatosEventosServidor[E];
}

/**
 * Lo que la API envía al servidor de tiempo real (`webSocket/`): el evento y
 * las salas que deben recibirlo. Ese servidor solo lo reparte.
 */
export interface EnvioTiempoReal<
  E extends EventoServidor = EventoServidor,
> extends EventoTiempoReal<E> {
  salas: string[];
}
