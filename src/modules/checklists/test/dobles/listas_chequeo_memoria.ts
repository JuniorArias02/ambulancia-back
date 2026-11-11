import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import { ListaChequeo } from '../../domain/entities/lista_chequeo.entity.js';
import {
  type FiltrosListasChequeo,
  ListasChequeoRepositorio,
} from '../../domain/repositories/listas_chequeo.repository.js';

export class ListasChequeoMemoria extends ListasChequeoRepositorio {
  readonly listas = new Map<string, ListaChequeo>();
  /** Preguntas que ya tienen respuestas guardadas. */
  readonly itemsConRespuestas = new Set<string>();

  buscarPorId(id: string): Promise<ListaChequeo | null> {
    return Promise.resolve(this.listas.get(id) ?? null);
  }

  buscarActiva(): Promise<ListaChequeo | null> {
    return Promise.resolve(
      [...this.listas.values()].find((l) => l.activa) ?? null,
    );
  }

  listar(
    { activa }: FiltrosListasChequeo,
    { pagina, limite }: Paginacion,
  ): Promise<ResultadoPaginado<ListaChequeo>> {
    const datos = [...this.listas.values()].filter(
      (l) => activa === undefined || l.activa === activa,
    );
    return Promise.resolve({ datos, total: datos.length, pagina, limite });
  }

  crear(lista: ListaChequeo): Promise<ListaChequeo> {
    this.listas.set(lista.id, lista);
    return Promise.resolve(lista);
  }

  actualizar(lista: ListaChequeo): Promise<ListaChequeo> {
    return this.crear(lista);
  }

  activarUnica(lista: ListaChequeo): Promise<ListaChequeo> {
    for (const otra of this.listas.values()) {
      if (otra.id !== lista.id) otra.desactivar(new Date());
    }
    return this.crear(lista);
  }

  itemTieneRespuestas(itemId: string): Promise<boolean> {
    return Promise.resolve(this.itemsConRespuestas.has(itemId));
  }
}

/** Lista válida: 2 preguntas (la segunda sin observaciones) y 3 opciones. */
export function crearListaPrueba(): ListaChequeo {
  return ListaChequeo.crear({
    nombre: 'Chequeo diario',
    creadaPorId: 'admin-1',
    items: [
      { pregunta: '¿Nivel de aceite del motor?' },
      { pregunta: '¿Luces y sirena funcionan?', permiteObservacion: false },
    ],
    estados: [{ nombre: 'Bien' }, { nombre: 'Regular' }, { nombre: 'Estable' }],
    fecha: new Date(),
  });
}
