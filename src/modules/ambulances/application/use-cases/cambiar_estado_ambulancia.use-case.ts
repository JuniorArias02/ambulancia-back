import { Injectable } from '@nestjs/common';
import {
  RecursoNoEncontradoError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import { PublicadorEventos } from '../../../../common/events/publicador_eventos.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type {
  Ambulancia,
  EstadoManual,
} from '../../domain/entities/ambulancia.entity.js';
import { AmbulanciasRepositorio } from '../../domain/repositories/ambulancias.repository.js';
import { TurnosRepositorio } from '../../domain/repositories/turnos.repository.js';

export interface CambiarEstadoAmbulanciaEntrada {
  ambulanciaId: string;
  estado: EstadoManual;
  motivo: string;
}

@Injectable()
export class CambiarEstadoAmbulancia {
  constructor(
    private readonly ambulanciasRepositorio: AmbulanciasRepositorio,
    private readonly turnosRepositorio: TurnosRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
    private readonly eventos: PublicadorEventos,
  ) {}

  async ejecutar(
    datos: CambiarEstadoAmbulanciaEntrada,
    contexto: ContextoSolicitud,
  ): Promise<Ambulancia> {
    const ambulancia = await this.ambulanciasRepositorio.buscarPorId(
      datos.ambulanciaId,
    );
    if (!ambulancia) throw new RecursoNoEncontradoError('Ambulancia');

    const estadoAnterior = ambulancia.estadoOperativo;
    ambulancia.cambiarEstadoManual(datos.estado);

    // Sin tripulación no se puede despachar: no tiene sentido mostrarla disponible.
    if (
      datos.estado === 'disponible' &&
      !(await this.turnosRepositorio.buscarActivoDeAmbulancia(ambulancia.id))
    ) {
      throw new ReglaNegocioError(
        'La ambulancia no tiene un turno activo; inicie un turno antes de habilitarla',
      );
    }

    const actualizada = await this.ambulanciasRepositorio.cambiarEstado(
      ambulancia,
      {
        id: crypto.randomUUID(),
        ambulanciaId: ambulancia.id,
        estadoAnterior,
        estadoNuevo: datos.estado,
        motivo: datos.motivo,
        usuarioId: contexto.usuarioId,
        cambiadoEn: new Date(),
      },
    );

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'ambulancias',
      entidadId: ambulancia.id,
      accion: 'cambiar_estado',
      detalle: { estadoAnterior, estadoNuevo: datos.estado },
      direccionIp: contexto.direccionIp,
    });
    this.eventos.publicar({
      tipo: 'ambulancia.actualizada',
      ambulanciaId: ambulancia.id,
    });

    return actualizada;
  }
}
