import { Injectable } from '@nestjs/common';
import {
  ConflictoNegocioError,
  RecursoNoEncontradoError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import { PublicadorEventos } from '../../../../common/events/publicador_eventos.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type { Turno } from '../../domain/entities/turno.entity.js';
import { TurnosRepositorio } from '../../domain/repositories/turnos.repository.js';

const MOTIVO_FIN_TURNO = 'Fin de turno';

/**
 * Sin tripulación la ambulancia no puede seguir disponible: si lo estaba,
 * pasa a fuera de servicio. Si está atendiendo un servicio, no se finaliza.
 * Es la salida de la central cuando alguien no cerró su turno desde la app.
 */
@Injectable()
export class FinalizarTurno {
  constructor(
    private readonly turnosRepositorio: TurnosRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
    private readonly eventos: PublicadorEventos,
  ) {}

  async ejecutar(turnoId: string, contexto: ContextoSolicitud): Promise<Turno> {
    const leido = await this.turnosRepositorio.buscarPorId(turnoId);
    if (!leido) throw new RecursoNoEncontradoError('Turno');
    if (!leido.estaActivo()) {
      throw new ReglaNegocioError('El turno ya está finalizado');
    }
    const ambulanciaId = leido.ambulanciaId;

    const { turno, quedaFueraDeServicio } =
      await this.turnosRepositorio.enExclusiva(
        { ambulanciaId },
        async (operaciones) => {
          const activo =
            await operaciones.buscarTurnoActivoDeAmbulancia(ambulanciaId);
          if (activo?.id !== turnoId) {
            throw new ConflictoNegocioError('El turno ya fue finalizado');
          }
          const ambulancia = await operaciones.buscarAmbulancia(ambulanciaId);
          if (!ambulancia) throw new RecursoNoEncontradoError('Ambulancia');
          if (ambulancia.estadoOperativo === 'en_servicio') {
            throw new ReglaNegocioError(
              'La ambulancia está atendiendo un servicio; finalícelo antes de cerrar el turno',
            );
          }

          const ahora = new Date();
          activo.finalizar(ahora);
          const estabaDisponible = ambulancia.estaDisponible();
          if (estabaDisponible) {
            ambulancia.cambiarEstadoManual('fuera_servicio');
            await operaciones.cambiarEstadoAmbulancia(ambulancia, {
              id: crypto.randomUUID(),
              ambulanciaId,
              estadoAnterior: 'disponible',
              estadoNuevo: 'fuera_servicio',
              motivo: MOTIVO_FIN_TURNO,
              usuarioId: contexto.usuarioId,
              cambiadoEn: ahora,
            });
          }
          return {
            turno: await operaciones.finalizarTurno(activo),
            quedaFueraDeServicio: estabaDisponible,
          };
        },
      );

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'turnos',
      entidadId: turno.id,
      accion: 'finalizar',
      detalle: { ambulanciaId },
      direccionIp: contexto.direccionIp,
    });
    this.eventos.publicar({
      tipo: 'turno.actualizado',
      turnoId: turno.id,
      usuariosAfectados: turno.integrantes.map((i) => i.usuarioId),
    });
    if (quedaFueraDeServicio) {
      this.eventos.publicar({
        tipo: 'ambulancia.actualizada',
        ambulanciaId,
      });
    }

    return turno;
  }
}
