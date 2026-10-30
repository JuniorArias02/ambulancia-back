import type {
  Paginacion,
  ResultadoPaginado,
} from '../../src/common/types/resultado_paginado.js';
import {
  type NuevoIntegrante,
  Turno,
} from '../../src/modules/ambulances/domain/entities/turno.entity.js';
import { TurnosRepositorio } from '../../src/modules/ambulances/domain/repositories/turnos.repository.js';

export class TurnosMemoria extends TurnosRepositorio {
  readonly turnos = new Map<string, Turno>();

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

  crear(turno: Turno): Promise<Turno> {
    this.turnos.set(turno.id, turno);
    return Promise.resolve(turno);
  }

  reemplazarIntegrantes(turno: Turno): Promise<Turno> {
    return this.crear(turno);
  }

  finalizar(turno: Turno): Promise<Turno> {
    return this.crear(turno);
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
