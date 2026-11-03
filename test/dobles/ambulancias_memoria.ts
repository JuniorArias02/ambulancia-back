import type {
  Paginacion,
  ResultadoPaginado,
} from '../../src/common/types/resultado_paginado.js';
import { Ambulancia } from '../../src/modules/ambulances/domain/entities/ambulancia.entity.js';
import type { CambioEstadoAmbulancia } from '../../src/modules/ambulances/domain/entities/cambio_estado_ambulancia.entity.js';
import type { TipoAmbulancia } from '../../src/modules/ambulances/domain/entities/tipo_ambulancia.entity.js';
import { AmbulanciasRepositorio } from '../../src/modules/ambulances/domain/repositories/ambulancias.repository.js';
import { TiposAmbulanciaRepositorio } from '../../src/modules/ambulances/domain/repositories/tipos_ambulancia.repository.js';

export const TIPOS_PRUEBA: TipoAmbulancia[] = [
  { id: 't1', nombre: 'TAB', descripcion: null },
  { id: 't2', nombre: 'TAM', descripcion: null },
];

export class TiposAmbulanciaMemoria extends TiposAmbulanciaRepositorio {
  listar(): Promise<TipoAmbulancia[]> {
    return Promise.resolve([...TIPOS_PRUEBA]);
  }

  buscarPorId(id: string): Promise<TipoAmbulancia | null> {
    return Promise.resolve(TIPOS_PRUEBA.find((tipo) => tipo.id === id) ?? null);
  }
}

export class AmbulanciasMemoria extends AmbulanciasRepositorio {
  readonly ambulancias = new Map<string, Ambulancia>();
  readonly historial: CambioEstadoAmbulancia[] = [];

  buscarPorId(id: string): Promise<Ambulancia | null> {
    return Promise.resolve(this.ambulancias.get(id) ?? null);
  }

  existeCodigo(codigo: string, excluirId?: string): Promise<boolean> {
    return Promise.resolve(
      [...this.ambulancias.values()].some(
        (a) => a.codigo === codigo && a.id !== excluirId,
      ),
    );
  }

  existePlaca(placa: string, excluirId?: string): Promise<boolean> {
    return Promise.resolve(
      [...this.ambulancias.values()].some(
        (a) => a.placa === placa && a.id !== excluirId,
      ),
    );
  }

  listar(
    _filtros: unknown,
    { pagina, limite }: Paginacion,
  ): Promise<ResultadoPaginado<Ambulancia>> {
    const datos = [...this.ambulancias.values()];
    return Promise.resolve({ datos, total: datos.length, pagina, limite });
  }

  listarTodas(): Promise<Ambulancia[]> {
    return Promise.resolve([...this.ambulancias.values()]);
  }

  crear(ambulancia: Ambulancia): Promise<Ambulancia> {
    this.ambulancias.set(ambulancia.id, ambulancia);
    return Promise.resolve(ambulancia);
  }

  actualizar(ambulancia: Ambulancia): Promise<Ambulancia> {
    this.ambulancias.set(ambulancia.id, ambulancia);
    return Promise.resolve(ambulancia);
  }

  cambiarEstado(
    ambulancia: Ambulancia,
    cambio: CambioEstadoAmbulancia,
  ): Promise<Ambulancia> {
    this.ambulancias.set(ambulancia.id, ambulancia);
    this.historial.push(cambio);
    return Promise.resolve(ambulancia);
  }

  listarHistorialEstados(
    ambulanciaId: string,
    { pagina, limite }: Paginacion,
  ): Promise<ResultadoPaginado<CambioEstadoAmbulancia>> {
    const datos = this.historial.filter((c) => c.ambulanciaId === ambulanciaId);
    return Promise.resolve({ datos, total: datos.length, pagina, limite });
  }
}

export function crearAmbulanciaPrueba(
  cambios: Partial<{ codigo: string; placa: string }> = {},
): Ambulancia {
  return Ambulancia.crear({
    codigo: cambios.codigo ?? 'amb-01',
    placa: cambios.placa ?? 'abc-123',
    tipo: TIPOS_PRUEBA[0]!,
  });
}
