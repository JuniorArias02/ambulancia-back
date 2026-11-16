import { Injectable } from '@nestjs/common';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import type { ResultadoPaginado } from '../../../../common/types/resultado_paginado.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type { EventoTrazabilidad } from '../../domain/consulta_clinica.js';
import { ConsultaClinicaRepositorio } from '../../domain/repositories/consulta_clinica.repository.js';
import { AccesoHistoriaClinica } from '../services/acceso_historia_clinica.service.js';

/**
 * Quién abrió, modificó, firmó, anuló o consultó una historia, y cuándo.
 * Sale de la auditoría, que nunca guarda valores clínicos.
 */
@Injectable()
export class ConsultarTrazabilidadHistoria {
  constructor(
    private readonly consultaRepositorio: ConsultaClinicaRepositorio,
    private readonly acceso: AccesoHistoriaClinica,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    historiaId: string,
    paginacion: { pagina: number; limite: number },
    contexto: ContextoSolicitud,
  ): Promise<ResultadoPaginado<EventoTrazabilidad>> {
    await this.acceso.buscarHistoria(historiaId);
    const resultado = await this.consultaRepositorio.trazabilidad(
      historiaId,
      paginacion.pagina,
      paginacion.limite,
    );
    // Se registra después de leer: la consulta actual no aparece en su propio resultado.
    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'historias_clinicas',
      entidadId: historiaId,
      accion: 'consultar_trazabilidad',
      direccionIp: contexto.direccionIp,
    });
    return resultado;
  }
}
