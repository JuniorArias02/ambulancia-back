import { Injectable } from '@nestjs/common';
import type { TipoAmbulancia } from '../../domain/entities/tipo_ambulancia.entity.js';
import { TiposAmbulanciaRepositorio } from '../../domain/repositories/tipos_ambulancia.repository.js';

@Injectable()
export class ConsultarTiposAmbulancia {
  constructor(
    private readonly tiposAmbulanciaRepositorio: TiposAmbulanciaRepositorio,
  ) {}

  ejecutar(): Promise<TipoAmbulancia[]> {
    return this.tiposAmbulanciaRepositorio.listar();
  }
}
