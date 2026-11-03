import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type {
  Emergencia,
  EstadoEmergencia,
} from '../../../emergencies/domain/entities/emergencia.entity.js';
import { EmergenciasRepositorio } from '../../../emergencies/domain/repositories/emergencias.repository.js';

export interface FiltrosMisEmergencias {
  estado?: EstadoEmergencia;
  desde?: Date;
  hasta?: Date;
}

/** Solo los reportes del propio ciudadano; el filtro por informante no lo elige el cliente. */
@Injectable()
export class ConsultarMisEmergencias {
  constructor(
    private readonly emergenciasRepositorio: EmergenciasRepositorio,
  ) {}

  listar(
    usuarioId: string,
    filtros: FiltrosMisEmergencias,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<Emergencia>> {
    return this.emergenciasRepositorio.listar(
      { ...filtros, informanteUsuarioId: usuarioId },
      paginacion,
    );
  }

  /** Un reporte ajeno responde igual que uno inexistente: no revela que existe. */
  async obtener(usuarioId: string, emergenciaId: string): Promise<Emergencia> {
    const emergencia =
      await this.emergenciasRepositorio.buscarPorId(emergenciaId);
    if (!emergencia || emergencia.informanteUsuarioId !== usuarioId) {
      throw new RecursoNoEncontradoError('Reporte');
    }
    return emergencia;
  }
}
