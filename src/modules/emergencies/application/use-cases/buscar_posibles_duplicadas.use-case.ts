import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import { EmergenciasRepositorio } from '../../domain/repositories/emergencias.repository.js';
import {
  CRITERIOS_DUPLICADOS,
  evaluarPosibleDuplicado,
  type PosibleDuplicado,
} from '../../domain/services/criterios_duplicados.js';

/** Solo sugiere: nunca marca una duplicada por su cuenta. */
@Injectable()
export class BuscarPosiblesDuplicadas {
  constructor(
    private readonly emergenciasRepositorio: EmergenciasRepositorio,
  ) {}

  async ejecutar(emergenciaId: string): Promise<PosibleDuplicado[]> {
    const emergencia =
      await this.emergenciasRepositorio.buscarPorId(emergenciaId);
    if (!emergencia) throw new RecursoNoEncontradoError('Emergencia');

    const desde = new Date(
      emergencia.recibidaEn.getTime() -
        CRITERIOS_DUPLICADOS.ventanaMinutos * 60_000,
    );
    const candidatas = await this.emergenciasRepositorio.listarActivasDesde(
      desde,
      emergencia.id,
    );

    return candidatas
      .map((candidata) => evaluarPosibleDuplicado(emergencia, candidata))
      .filter((posible): posible is PosibleDuplicado => posible !== null)
      .sort(
        (a, b) =>
          (a.distanciaMetros ?? Number.MAX_SAFE_INTEGER) -
          (b.distanciaMetros ?? Number.MAX_SAFE_INTEGER),
      );
  }
}
