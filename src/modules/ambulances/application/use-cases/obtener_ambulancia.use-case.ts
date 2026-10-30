import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type { Ambulancia } from '../../domain/entities/ambulancia.entity.js';
import { AmbulanciasRepositorio } from '../../domain/repositories/ambulancias.repository.js';

@Injectable()
export class ObtenerAmbulancia {
  constructor(
    private readonly ambulanciasRepositorio: AmbulanciasRepositorio,
  ) {}

  async ejecutar(ambulanciaId: string): Promise<Ambulancia> {
    const ambulancia =
      await this.ambulanciasRepositorio.buscarPorId(ambulanciaId);
    if (!ambulancia) throw new RecursoNoEncontradoError('Ambulancia');
    return ambulancia;
  }
}
