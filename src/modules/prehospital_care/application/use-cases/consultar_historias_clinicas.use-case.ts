import { Injectable } from '@nestjs/common';
import { Roles } from '../../../../common/constants/roles.js';
import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type { HistoriaClinica } from '../../domain/entities/historia_clinica.entity.js';
import {
  type FiltrosHistorias,
  HistoriasClinicasRepositorio,
} from '../../domain/repositories/historias_clinicas.repository.js';
import {
  AccesoHistoriaClinica,
  type Solicitante,
} from '../services/acceso_historia_clinica.service.js';

/** Las historias de un servicio (una por paciente). La tripulación solo las de su servicio. */
@Injectable()
export class ConsultarHistoriasClinicas {
  constructor(
    private readonly historiasRepositorio: HistoriasClinicasRepositorio,
    private readonly acceso: AccesoHistoriaClinica,
  ) {}

  async ejecutar(
    filtros: FiltrosHistorias,
    solicitante: Solicitante,
  ): Promise<HistoriaClinica[]> {
    if (filtros.asignacionId) {
      await this.acceso.exigirLecturaDeAsignacion(
        filtros.asignacionId,
        solicitante,
      );
    } else if (!(
      filtros.emergenciaId && solicitante.rol === Roles.ADMINISTRADOR
    )) {
      throw new ReglaNegocioError(
        'Indique asignacionId (o emergenciaId, solo el administrador)',
      );
    }
    return this.historiasRepositorio.listar(filtros);
  }
}
