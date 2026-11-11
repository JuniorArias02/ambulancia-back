import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { EventoDominio } from '../../../../common/events/eventos_dominio.js';
import { PublicadorEventos } from '../../../../common/events/publicador_eventos.js';
import { ObtenerAsignacion } from '../../../assignments/application/use-cases/obtener_asignacion.use-case.js';
import { ObtenerSeguimientoEmergencia } from '../../../citizens/application/use-cases/obtener_seguimiento_emergencia.use-case.js';
import { SeguimientoEmergenciaRespuestaDto } from '../../../citizens/presentation/dto/seguimiento_emergencia_respuesta.dto.js';
import { ObtenerEmergencia } from '../../../emergencies/application/use-cases/obtener_emergencia.use-case.js';
import { vaHaciaElLugar } from '../../../citizens/domain/services/seguimiento_ambulancia.js';
import { LimitadorUbicaciones } from '../../application/services/limitador_ubicaciones.js';
import { salaDeUsuario } from '../../domain/salas_tiempo_real.js';
import { EmisorTiempoReal } from './emisor_tiempo_real.js';

/**
 * Avisa al ciudadano que reportó la emergencia mientras su ambulancia va hacia
 * el lugar: cada movimiento, cambio de etapa o recálculo de la llegada, con el
 * mismo cuerpo de `GET /ciudadanos/emergencias/{id}/seguimiento`. Al llegar
 * (o cerrarse) envía un aviso con `disponible: false` y no vuelve a enviar
 * posiciones. Solo va a su sala personal.
 */
@Injectable()
export class NotificadorSeguimientoCiudadano implements OnModuleInit {
  /** Propio: compartir el de la central haría que uno de los dos se quedara sin el aviso. */
  private readonly limitadorUbicaciones = new LimitadorUbicaciones();

  constructor(
    private readonly eventos: PublicadorEventos,
    private readonly emisor: EmisorTiempoReal,
    private readonly obtenerAsignacion: ObtenerAsignacion,
    private readonly obtenerEmergencia: ObtenerEmergencia,
    private readonly obtenerSeguimiento: ObtenerSeguimientoEmergencia,
  ) {}

  onModuleInit(): void {
    this.eventos.suscribir((evento) => this.notificar(evento));
  }

  async notificar(evento: EventoDominio): Promise<void> {
    switch (evento.tipo) {
      // Los cambios de etapa siempre avisan: así llega también el aviso de fin.
      case 'asignacion.creada':
      case 'asignacion.actualizada':
        return this.avisar(evento.asignacionId, true);
      case 'asignacion.ruta_actualizada':
        return this.avisar(evento.asignacionId, false);
      case 'ambulancia.ubicacion_actualizada':
        if (
          evento.asignacionId &&
          this.limitadorUbicaciones.permite(evento.ambulanciaId)
        ) {
          return this.avisar(evento.asignacionId, false);
        }
        return;
      default:
        return;
    }
  }

  /** `cambioDeEtapa`: avisa aunque el seguimiento ya no esté disponible. */
  private async avisar(
    asignacionId: string,
    cambioDeEtapa: boolean,
  ): Promise<void> {
    const asignacion = await this.obtenerAsignacion.ejecutar(asignacionId);
    // Ya en el lugar, su GPS y su ruta (la del traslado) no son para el informante.
    if (!cambioDeEtapa && !vaHaciaElLugar(asignacion.estado)) return;
    const emergencia = await this.obtenerEmergencia.ejecutar(
      asignacion.emergenciaId,
    );
    // Solo los reportes hechos desde la app tienen a quién avisar.
    const informante = emergencia.informanteUsuarioId;
    if (!informante) return;

    const seguimiento = await this.obtenerSeguimiento.ejecutar(
      informante,
      emergencia.id,
    );
    this.emisor.emitir(salaDeUsuario(informante), 'seguimiento.actualizado', {
      seguimiento: SeguimientoEmergenciaRespuestaDto.desde(seguimiento),
    });
  }
}
