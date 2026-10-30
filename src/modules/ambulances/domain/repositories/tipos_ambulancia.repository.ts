import type { TipoAmbulancia } from '../entities/tipo_ambulancia.entity.js';

export abstract class TiposAmbulanciaRepositorio {
  abstract listar(): Promise<TipoAmbulancia[]>;
  abstract buscarPorId(id: string): Promise<TipoAmbulancia | null>;
}
