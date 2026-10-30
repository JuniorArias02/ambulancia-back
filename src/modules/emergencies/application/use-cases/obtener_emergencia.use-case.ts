import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type { Emergencia } from '../../domain/entities/emergencia.entity.js';
import { EmergenciasRepositorio } from '../../domain/repositories/emergencias.repository.js';

@Injectable()
export class ObtenerEmergencia {
  constructor(
    private readonly emergenciasRepositorio: EmergenciasRepositorio,
  ) {}

  async ejecutar(emergenciaId: string): Promise<Emergencia> {
    const emergencia =
      await this.emergenciasRepositorio.buscarPorId(emergenciaId);
    if (!emergencia) throw new RecursoNoEncontradoError('Emergencia');
    return emergencia;
  }
}
