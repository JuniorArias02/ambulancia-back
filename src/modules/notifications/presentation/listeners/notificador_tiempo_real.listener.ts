import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { EventoDominio } from '../../../../common/events/eventos_dominio.js';
import { PublicadorEventos } from '../../../../common/events/publicador_eventos.js';
import { ObtenerAmbulancia } from '../../../ambulances/application/use-cases/obtener_ambulancia.use-case.js';
import { ObtenerTurno } from '../../../ambulances/application/use-cases/obtener_turno.use-case.js';
import { AmbulanciaRespuestaDto } from '../../../ambulances/presentation/dto/ambulancia_respuesta.dto.js';
import { TurnoRespuestaDto } from '../../../ambulances/presentation/dto/turno_respuesta.dto.js';
import { ConsultarAsignaciones } from '../../../assignments/application/use-cases/consultar_asignaciones.use-case.js';
import { ObtenerAsignacion } from '../../../assignments/application/use-cases/obtener_asignacion.use-case.js';
import { ObtenerMiServicio } from '../../../assignments/application/use-cases/obtener_mi_servicio.use-case.js';
import type { Asignacion } from '../../../assignments/domain/entities/asignacion.entity.js';
import {
  AsignacionRespuestaDto,
  MiServicioRespuestaDto,
} from '../../../assignments/presentation/dto/asignacion_respuesta.dto.js';
import { BuscarPosiblesDuplicadas } from '../../../emergencies/application/use-cases/buscar_posibles_duplicadas.use-case.js';
import { ObtenerEmergencia } from '../../../emergencies/application/use-cases/obtener_emergencia.use-case.js';
import {
  EmergenciaRespuestaDto,
  PosibleDuplicadaRespuestaDto,
} from '../../../emergencies/presentation/dto/emergencia_respuesta.dto.js';
import { ObtenerRutaAsignacion } from '../../../routing/application/use-cases/obtener_ruta_asignacion.use-case.js';
import { RutaRespuestaDto } from '../../../routing/presentation/dto/ruta_respuesta.dto.js';
import { LimitadorUbicaciones } from '../../application/services/limitador_ubicaciones.js';
import { SALA_CENTRAL, salaDeUsuario } from '../../domain/salas_tiempo_real.js';
import { EmisorTiempoReal } from './emisor_tiempo_real.js';

type EventoUbicacion = Extract<
  EventoDominio,
  { tipo: 'ambulancia.ubicacion_actualizada' }
>;

/** Una emergencia no llega a tener tantas ambulancias activas a la vez. */
const PAGINA_ASIGNACIONES_ACTIVAS = { pagina: 1, limite: 100 };

/**
 * Traduce los eventos de dominio en notificaciones: recarga el estado vigente
 * con los mismos casos de uso y DTO del REST y decide quién debe recibirlo.
 */
@Injectable()
export class NotificadorTiempoReal implements OnModuleInit {
  constructor(
    private readonly eventos: PublicadorEventos,
    private readonly emisor: EmisorTiempoReal,
    private readonly limitadorUbicaciones: LimitadorUbicaciones,
    private readonly obtenerEmergencia: ObtenerEmergencia,
    private readonly buscarPosiblesDuplicadas: BuscarPosiblesDuplicadas,
    private readonly obtenerAsignacion: ObtenerAsignacion,
    private readonly consultarAsignaciones: ConsultarAsignaciones,
    private readonly obtenerAmbulancia: ObtenerAmbulancia,
    private readonly obtenerTurno: ObtenerTurno,
    private readonly obtenerMiServicio: ObtenerMiServicio,
    private readonly obtenerRuta: ObtenerRutaAsignacion,
  ) {}

  onModuleInit(): void {
    this.eventos.suscribir((evento) => this.notificar(evento));
  }

  async notificar(evento: EventoDominio): Promise<void> {
    switch (evento.tipo) {
      case 'emergencia.creada':
        return this.emergenciaCreada(evento.emergenciaId);
      case 'emergencia.actualizada':
        return this.emergenciaActualizada(evento.emergenciaId, evento.cambios);
      case 'asignacion.creada':
      case 'asignacion.actualizada':
        return this.asignacionCambiada(evento.tipo, evento.asignacionId);
      case 'asignacion.ruta_actualizada':
        return this.rutaActualizada(evento.asignacionId);
      case 'ambulancia.actualizada':
        return this.ambulanciaActualizada(evento.ambulanciaId);
      case 'ambulancia.ubicacion_actualizada':
        return this.ubicacionActualizada(evento);
      case 'turno.actualizado':
        return this.turnoActualizado(evento.turnoId, evento.usuariosAfectados);
    }
  }

  private async emergenciaCreada(emergenciaId: string): Promise<void> {
    const emergencia = await this.obtenerEmergencia.ejecutar(emergenciaId);
    this.emisor.emitir(SALA_CENTRAL, 'emergencia.creada', {
      emergencia: EmergenciaRespuestaDto.desde(emergencia),
    });

    // Solo se sugiere al despachador; nunca se marca como duplicada sola.
    const posibles = await this.buscarPosiblesDuplicadas.ejecutar(emergenciaId);
    if (posibles.length > 0) {
      this.emisor.emitir(SALA_CENTRAL, 'emergencia.posible_duplicado', {
        emergenciaId,
        numeroEmergencia: emergencia.numeroEmergencia,
        posibles: posibles.map((p) => PosibleDuplicadaRespuestaDto.desde(p)),
      });
    }
  }

  private async emergenciaActualizada(
    emergenciaId: string,
    cambios: readonly string[],
  ): Promise<void> {
    const emergencia = await this.obtenerEmergencia.ejecutar(emergenciaId);
    this.emisor.emitir(SALA_CENTRAL, 'emergencia.actualizada', {
      emergencia: EmergenciaRespuestaDto.desde(emergencia),
      cambios,
    });

    // La tripulación en camino ve en el acto un cambio de prioridad o de dirección.
    const activas = await this.consultarAsignaciones.ejecutar(
      { emergenciaId, soloActivas: true },
      PAGINA_ASIGNACIONES_ACTIVAS,
    );
    await this.notificarMiServicio(await this.tripulantesDe(activas.datos));
  }

  private async asignacionCambiada(
    tipo: 'asignacion.creada' | 'asignacion.actualizada',
    asignacionId: string,
  ): Promise<void> {
    const asignacion = await this.obtenerAsignacion.ejecutar(asignacionId);
    this.emisor.emitir(SALA_CENTRAL, tipo, {
      asignacion: AsignacionRespuestaDto.desde(asignacion),
    });
    await this.notificarMiServicio(await this.tripulantesDe([asignacion]));
  }

  /** La central redibuja la línea; la tripulación, la de su propio servicio. */
  private async rutaActualizada(asignacionId: string): Promise<void> {
    const rutaDeAsignacion = await this.obtenerRuta.ejecutar(asignacionId);
    const tripulantes = await this.tripulantesDe([rutaDeAsignacion.asignacion]);
    this.emisor.emitir(
      [SALA_CENTRAL, ...tripulantes.map((id) => salaDeUsuario(id))],
      'asignacion.ruta_actualizada',
      { ruta: RutaRespuestaDto.desde(rutaDeAsignacion) },
    );
  }

  private async ambulanciaActualizada(ambulanciaId: string): Promise<void> {
    const ambulancia = await this.obtenerAmbulancia.ejecutar(ambulanciaId);
    this.emisor.emitir(SALA_CENTRAL, 'ambulancia.actualizada', {
      ambulancia: AmbulanciaRespuestaDto.desde(ambulancia),
    });
  }

  private ubicacionActualizada({ tipo, ...ubicacion }: EventoUbicacion): void {
    if (!this.limitadorUbicaciones.permite(ubicacion.ambulanciaId)) return;
    this.emisor.emitir(SALA_CENTRAL, tipo, ubicacion);
  }

  private async turnoActualizado(
    turnoId: string,
    usuariosAfectados: readonly string[],
  ): Promise<void> {
    const turno = await this.obtenerTurno.ejecutar(turnoId);
    this.emisor.emitir(SALA_CENTRAL, 'turno.actualizado', {
      turno: TurnoRespuestaDto.desde(turno),
    });
    await this.notificarMiServicio(usuariosAfectados);
  }

  private async tripulantesDe(
    asignaciones: readonly Asignacion[],
  ): Promise<string[]> {
    const turnoIds = new Set(
      asignaciones
        .map((a) => a.turnoId)
        .filter((id): id is string => id !== null),
    );
    const turnos = await Promise.all(
      [...turnoIds].map((id) => this.obtenerTurno.ejecutar(id)),
    );
    return turnos.flatMap((t) => t.integrantes.map((i) => i.usuarioId));
  }

  /** Cada tripulante recibe solo su propio servicio, con la forma de `GET /mi-servicio`. */
  private async notificarMiServicio(
    usuarioIds: readonly string[],
  ): Promise<void> {
    await Promise.all(
      [...new Set(usuarioIds)].map(async (usuarioId) => {
        const servicio = await this.obtenerMiServicio.ejecutar(usuarioId);
        this.emisor.emitir(
          salaDeUsuario(usuarioId),
          'mi_servicio.actualizado',
          MiServicioRespuestaDto.desde(servicio),
        );
      }),
    );
  }
}
