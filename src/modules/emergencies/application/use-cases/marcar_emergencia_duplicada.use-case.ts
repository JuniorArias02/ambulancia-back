import { Injectable } from '@nestjs/common';
import {
  RecursoNoEncontradoError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import { PublicadorEventos } from '../../../../common/events/publicador_eventos.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type { Emergencia } from '../../domain/entities/emergencia.entity.js';
import { EmergenciasRepositorio } from '../../domain/repositories/emergencias.repository.js';

export interface MarcarEmergenciaDuplicadaEntrada {
  emergenciaId: string;
  emergenciaPrincipalId: string;
}

@Injectable()
export class MarcarEmergenciaDuplicada {
  constructor(
    private readonly emergenciasRepositorio: EmergenciasRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
    private readonly eventos: PublicadorEventos,
  ) {}

  async ejecutar(
    datos: MarcarEmergenciaDuplicadaEntrada,
    contexto: ContextoSolicitud,
  ): Promise<Emergencia> {
    const emergencia = await this.emergenciasRepositorio.buscarPorId(
      datos.emergenciaId,
    );
    if (!emergencia) throw new RecursoNoEncontradoError('Emergencia');

    const principal = await this.emergenciasRepositorio.buscarPorId(
      datos.emergenciaPrincipalId,
    );
    if (!principal) {
      throw new ReglaNegocioError('La emergencia principal no existe');
    }

    const estadoAnterior = emergencia.estado;
    emergencia.marcarDuplicadaDe(principal, new Date());
    const duplicada = await this.emergenciasRepositorio.actualizar(
      emergencia,
      estadoAnterior,
    );

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'emergencias',
      entidadId: emergencia.id,
      accion: 'marcar_duplicada',
      detalle: {
        emergenciaPrincipalId: principal.id,
        numeroPrincipal: principal.numeroEmergencia,
      },
      direccionIp: contexto.direccionIp,
    });
    this.eventos.publicar({
      tipo: 'emergencia.actualizada',
      emergenciaId: emergencia.id,
      cambios: ['estado', 'emergenciaPrincipalId'],
    });

    return duplicada;
  }
}
