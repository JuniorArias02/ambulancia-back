import { Injectable } from '@nestjs/common';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type { ValoracionDownton } from '../../domain/entities/valoracion_downton.entity.js';
import { HistoriasClinicasRepositorio } from '../../domain/repositories/historias_clinicas.repository.js';
import {
  AccesoHistoriaClinica,
  type Solicitante,
} from '../services/acceso_historia_clinica.service.js';

/** Valoraciones de caídas de una historia, de la más antigua a la más reciente. Consulta auditada. */
@Injectable()
export class ConsultarValoracionesDownton {
  constructor(
    private readonly historiasRepositorio: HistoriasClinicasRepositorio,
    private readonly acceso: AccesoHistoriaClinica,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    historiaId: string,
    solicitante: Solicitante,
    contexto: ContextoSolicitud,
  ): Promise<ValoracionDownton[]> {
    const historia = await this.acceso.buscarHistoria(historiaId);
    await this.acceso.exigirLectura(historia, solicitante);
    const valoraciones =
      await this.historiasRepositorio.listarValoracionesDownton(historiaId);
    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'historias_clinicas',
      entidadId: historiaId,
      accion: 'consultar_valoraciones_downton',
      direccionIp: contexto.direccionIp,
    });
    return valoraciones;
  }
}
