import { Injectable } from '@nestjs/common';
import {
  RecursoNoEncontradoError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import { PublicadorEventos } from '../../../../common/events/publicador_eventos.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type { Turno } from '../../domain/entities/turno.entity.js';
import { AmbulanciasRepositorio } from '../../domain/repositories/ambulancias.repository.js';
import { TurnosRepositorio } from '../../domain/repositories/turnos.repository.js';

const MOTIVO_FIN_TURNO = 'Fin de turno';

/**
 * Sin tripulación la ambulancia no puede seguir disponible: si lo estaba,
 * pasa a fuera de servicio. Si está atendiendo un servicio, no se finaliza.
 */
@Injectable()
export class FinalizarTurno {
  constructor(
    private readonly turnosRepositorio: TurnosRepositorio,
    private readonly ambulanciasRepositorio: AmbulanciasRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
    private readonly eventos: PublicadorEventos,
  ) {}

  async ejecutar(turnoId: string, contexto: ContextoSolicitud): Promise<Turno> {
    const turno = await this.turnosRepositorio.buscarPorId(turnoId);
    if (!turno) throw new RecursoNoEncontradoError('Turno');

    const ambulancia = await this.ambulanciasRepositorio.buscarPorId(
      turno.ambulanciaId,
    );
    if (!ambulancia) throw new RecursoNoEncontradoError('Ambulancia');
    if (ambulancia.estadoOperativo === 'en_servicio') {
      throw new ReglaNegocioError(
        'La ambulancia está atendiendo un servicio; finalícelo antes de cerrar el turno',
      );
    }

    turno.finalizar(new Date());
    const quedaFueraDeServicio = ambulancia.estaDisponible();

    // Primero la ambulancia: si falla, el turno sigue activo y no queda
    // una ambulancia disponible sin tripulación.
    if (quedaFueraDeServicio) {
      ambulancia.cambiarEstadoManual('fuera_servicio');
      await this.ambulanciasRepositorio.cambiarEstado(ambulancia, {
        id: crypto.randomUUID(),
        ambulanciaId: ambulancia.id,
        estadoAnterior: 'disponible',
        estadoNuevo: 'fuera_servicio',
        motivo: MOTIVO_FIN_TURNO,
        usuarioId: contexto.usuarioId,
        cambiadoEn: new Date(),
      });
    }

    const finalizado = await this.turnosRepositorio.finalizar(turno);

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'turnos',
      entidadId: turno.id,
      accion: 'finalizar',
      detalle: { ambulanciaId: turno.ambulanciaId },
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
        ambulanciaId: ambulancia.id,
      });
    }

    return finalizado;
  }
}
