import type {
  Paginacion,
  ResultadoPaginado,
} from '../../src/common/types/resultado_paginado.js';
import {
  type NuevoIntegrante,
  Turno,
} from '../../src/modules/ambulances/domain/entities/turno.entity.js';
import {
  type OperacionesTripulacion,
  TurnosRepositorio,
} from '../../src/modules/ambulances/domain/repositories/turnos.repository.js';
import type { AmbulanciasMemoria } from './ambulancias_memoria.js';

export class TurnosMemoria extends TurnosRepositorio {
  readonly turnos = new Map<string, Turno>();
  /** Turnos que ya atendieron algún servicio. */
  readonly conServicios = new Set<string>();

  /** `ambulancias` solo hace falta en las pruebas que usan `enExclusiva`. */
  constructor(private readonly ambulancias?: AmbulanciasMemoria) {
    super();
  }

  buscarPorId(id: string): Promise<Turno | null> {
    return Promise.resolve(this.turnos.get(id) ?? null);
  }

  buscarActivoDeAmbulancia(ambulanciaId: string): Promise<Turno | null> {
    return Promise.resolve(
      [...this.turnos.values()].find(
        (t) => t.ambulanciaId === ambulanciaId && t.estaActivo(),
      ) ?? null,
    );
  }

  buscarActivoDeUsuario(usuarioId: string): Promise<Turno | null> {
    return Promise.resolve(
      [...this.turnos.values()].find(
        (t) => t.estaActivo() && t.incluyeA(usuarioId),
      ) ?? null,
    );
  }

  listar(
    _filtros: unknown,
    { pagina, limite }: Paginacion,
  ): Promise<ResultadoPaginado<Turno>> {
    const datos = [...this.turnos.values()];
    return Promise.resolve({ datos, total: datos.length, pagina, limite });
  }

  listarActivos(): Promise<Turno[]> {
    return Promise.resolve(
      [...this.turnos.values()].filter((t) => t.estaActivo()),
    );
  }

  /** Para preparar datos en las pruebas. */
  crear(turno: Turno): Promise<Turno> {
    this.turnos.set(turno.id, turno);
    return Promise.resolve(turno);
  }

  enExclusiva<T>(
    _bloqueo: unknown,
    trabajo: (operaciones: OperacionesTripulacion) => Promise<T>,
  ): Promise<T> {
    const ambulancias = this.ambulancias;
    if (!ambulancias) {
      throw new Error('TurnosMemoria necesita ambulancias para esta prueba');
    }
    return trabajo({
      buscarAmbulancia: (id) => ambulancias.buscarPorId(id),
      buscarTurnoActivoDeAmbulancia: (id) => this.buscarActivoDeAmbulancia(id),
      buscarTurnoActivoDeUsuario: (id) => this.buscarActivoDeUsuario(id),
      tieneServicios: (id) => Promise.resolve(this.conServicios.has(id)),
      crearTurno: (turno) => this.crear(turno),
      agregarIntegrante: (id) => Promise.resolve(this.turnos.get(id) as Turno),
      finalizarTurno: (turno) => this.crear(turno),
      cambiarEstadoAmbulancia: async (ambulancia, cambio) => {
        await ambulancias.cambiarEstado(ambulancia, cambio);
      },
    });
  }
}

export const TRIPULACION_PRUEBA: NuevoIntegrante[] = [
  { usuarioId: 'conductor-1', funcion: 'conductor' },
  { usuarioId: 'paramedico-1', funcion: 'paramedico' },
];

export function crearTurnoPrueba(
  ambulanciaId: string,
  integrantes: NuevoIntegrante[] = TRIPULACION_PRUEBA,
): Turno {
  return Turno.iniciar({ ambulanciaId, integrantes, inicio: new Date() });
}
