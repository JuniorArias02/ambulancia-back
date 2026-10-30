import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import { PublicadorEventos } from '../../../../common/events/publicador_eventos.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type {
  DatosEditablesEmergencia,
  Emergencia,
} from '../../domain/entities/emergencia.entity.js';
import { EmergenciasRepositorio } from '../../domain/repositories/emergencias.repository.js';

export type ActualizarEmergenciaEntrada = DatosEditablesEmergencia;

@Injectable()
export class ActualizarEmergencia {
  constructor(
    private readonly emergenciasRepositorio: EmergenciasRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
    private readonly eventos: PublicadorEventos,
  ) {}

  async ejecutar(
    emergenciaId: string,
    datos: ActualizarEmergenciaEntrada,
    contexto: ContextoSolicitud,
  ): Promise<Emergencia> {
    const emergencia =
      await this.emergenciasRepositorio.buscarPorId(emergenciaId);
    if (!emergencia) throw new RecursoNoEncontradoError('Emergencia');

    const estadoLeido = emergencia.estado;
    const prioridadAnterior = emergencia.prioridad;
    emergencia.actualizarDatos(datos);

    const actualizada = await this.emergenciasRepositorio.actualizar(
      emergencia,
      estadoLeido,
    );

    const campos = Object.entries(datos)
      .filter(([, valor]) => valor !== undefined)
      .map(([campo]) => campo);

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'emergencias',
      entidadId: emergencia.id,
      accion: 'actualizar',
      detalle: {
        campos,
        // Re-clasificar la prioridad es sensible: queda el antes y el después.
        ...(prioridadAnterior !== actualizada.prioridad && {
          prioridadAnterior,
          prioridadNueva: actualizada.prioridad,
        }),
      },
      direccionIp: contexto.direccionIp,
    });
    this.eventos.publicar({
      tipo: 'emergencia.actualizada',
      emergenciaId: emergencia.id,
      cambios: campos,
    });

    return actualizada;
  }
}
