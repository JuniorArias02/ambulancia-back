import { Injectable } from '@nestjs/common';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type { HistoriaClinica } from '../../domain/entities/historia_clinica.entity.js';
import { HistoriasClinicasRepositorio } from '../../domain/repositories/historias_clinicas.repository.js';
import { AccesoHistoriaClinica } from '../services/acceso_historia_clinica.service.js';

/** Solo el administrador (lo exige el controlador). El contenido no se borra; el motivo queda auditado. */
@Injectable()
export class AnularHistoriaClinica {
  constructor(
    private readonly historiasRepositorio: HistoriasClinicasRepositorio,
    private readonly acceso: AccesoHistoriaClinica,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    historiaId: string,
    motivo: string,
    contexto: ContextoSolicitud,
  ): Promise<HistoriaClinica> {
    const historia = await this.acceso.buscarHistoria(historiaId);
    const estadoAnterior = historia.estado;
    historia.anular();
    const anulada = await this.historiasRepositorio.actualizar(
      historia,
      estadoAnterior,
    );

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'historias_clinicas',
      entidadId: historia.id,
      accion: 'anular',
      detalle: { estadoAnterior, motivo: motivo.trim() },
      direccionIp: contexto.direccionIp,
    });
    return anulada;
  }
}
