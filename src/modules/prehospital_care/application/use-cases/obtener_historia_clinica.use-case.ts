import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import {
  type DetalleHistoria,
  HistoriasClinicasRepositorio,
} from '../../domain/repositories/historias_clinicas.repository.js';
import {
  AccesoHistoriaClinica,
  type Solicitante,
} from '../services/acceso_historia_clinica.service.js';

/** Cada consulta del detalle queda auditada: son datos de salud (arquitectura.md §9). */
@Injectable()
export class ObtenerHistoriaClinica {
  constructor(
    private readonly historiasRepositorio: HistoriasClinicasRepositorio,
    private readonly acceso: AccesoHistoriaClinica,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    historiaId: string,
    solicitante: Solicitante,
    contexto: ContextoSolicitud,
  ): Promise<DetalleHistoria> {
    const detalle = await this.historiasRepositorio.buscarDetalle(historiaId);
    if (!detalle) throw new RecursoNoEncontradoError('Historia clínica');
    await this.acceso.exigirLectura(detalle.historia, solicitante);

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'historias_clinicas',
      entidadId: historiaId,
      accion: 'consultar',
      direccionIp: contexto.direccionIp,
    });
    return detalle;
  }
}
