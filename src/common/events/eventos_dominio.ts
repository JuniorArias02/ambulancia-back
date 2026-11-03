/**
 * Hechos ya confirmados en la base de datos. Solo llevan identificadores:
 * quien los consuma recarga el estado vigente en vez de confiar en una copia.
 */
export type EventoDominio =
  | { tipo: 'emergencia.creada'; emergenciaId: string }
  | {
      tipo: 'emergencia.actualizada';
      emergenciaId: string;
      cambios: readonly string[];
    }
  | { tipo: 'asignacion.creada'; asignacionId: string }
  | { tipo: 'asignacion.actualizada'; asignacionId: string }
  /** Se calculó una ruta nueva para el servicio. */
  | { tipo: 'asignacion.ruta_actualizada'; asignacionId: string }
  | { tipo: 'ambulancia.actualizada'; ambulanciaId: string }
  | {
      tipo: 'ambulancia.ubicacion_actualizada';
      ambulanciaId: string;
      asignacionId: string | null;
      latitud: number;
      longitud: number;
      velocidad: number | null;
      registradaEn: Date;
    }
  | {
      tipo: 'turno.actualizado';
      turnoId: string;
      /** Integrantes anteriores y nuevos: a quien sale del turno también hay que avisarle. */
      usuariosAfectados: readonly string[];
    };

export type TipoEventoDominio = EventoDominio['tipo'];
