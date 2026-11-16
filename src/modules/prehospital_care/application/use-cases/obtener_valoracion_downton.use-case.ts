import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type { ValoracionDownton } from '../../domain/entities/valoracion_downton.entity.js';
import { HistoriasClinicasRepositorio } from '../../domain/repositories/historias_clinicas.repository.js';
import {
  AccesoHistoriaClinica,
  type Solicitante,
} from '../services/acceso_historia_clinica.service.js';

/** Una valoración de caídas de la historia indicada. Consulta auditada. */
@Injectable()
export class ObtenerValoracionDownton {
  constructor(
    private readonly historiasRepositorio: HistoriasClinicasRepositorio,
    private readonly acceso: AccesoHistoriaClinica,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    historiaId: string,
    valoracionId: string,
    solicitante: Solicitante,
    contexto: ContextoSolicitud,
  ): Promise<ValoracionDownton> {
    const historia = await this.acceso.buscarHistoria(historiaId);
    await this.acceso.exigirLectura(historia, solicitante);
    const valoracion = await this.historiasRepositorio.buscarValoracionDownton(
      historiaId,
      valoracionId,
    );
    if (!valoracion) throw new RecursoNoEncontradoError('Valoración Downton');
    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'historias_clinicas',
      entidadId: historiaId,
      accion: 'consultar_valoracion_downton',
      detalle: { registroId: valoracion.id },
      direccionIp: contexto.direccionIp,
    });
    return valoracion;
  }
}
