import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import { PublicadorEventos } from '../../../../common/events/publicador_eventos.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type { Emergencia } from '../../domain/entities/emergencia.entity.js';
import { EmergenciasRepositorio } from '../../domain/repositories/emergencias.repository.js';

export interface CancelarEmergenciaEntrada {
  emergenciaId: string;
  motivo: string;
}

@Injectable()
export class CancelarEmergencia {
  constructor(
    private readonly emergenciasRepositorio: EmergenciasRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
    private readonly eventos: PublicadorEventos,
  ) {}

  async ejecutar(
    datos: CancelarEmergenciaEntrada,
    contexto: ContextoSolicitud,
  ): Promise<Emergencia> {
    const emergencia = await this.emergenciasRepositorio.buscarPorId(
      datos.emergenciaId,
    );
    if (!emergencia) throw new RecursoNoEncontradoError('Emergencia');

    const estadoAnterior = emergencia.estado;
    emergencia.cancelar(new Date());
    const cancelada = await this.emergenciasRepositorio.actualizar(
      emergencia,
      estadoAnterior,
    );

    // La tabla emergencias no tiene columna de motivo: queda en la auditoría.
    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'emergencias',
      entidadId: emergencia.id,
      accion: 'cancelar',
      detalle: { estadoAnterior, motivo: datos.motivo },
      direccionIp: contexto.direccionIp,
    });
    this.eventos.publicar({
      tipo: 'emergencia.actualizada',
      emergenciaId: emergencia.id,
      cambios: ['estado'],
    });

    return cancelada;
  }
}
