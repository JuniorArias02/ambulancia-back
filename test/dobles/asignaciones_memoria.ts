import { ConflictoNegocioError } from '../../src/common/exceptions/errores_dominio.js';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../src/common/types/resultado_paginado.js';
import type {
  Asignacion,
  EstadoAsignacion,
} from '../../src/modules/assignments/domain/entities/asignacion.entity.js';
import type { EventoAsignacion } from '../../src/modules/assignments/domain/entities/evento_asignacion.entity.js';
import {
  AsignacionesRepositorio,
  type CambioAmbulancia,
  type CambioEmergencia,
  type FiltrosAsignaciones,
} from '../../src/modules/assignments/domain/repositories/asignaciones.repository.js';
import type { AmbulanciasMemoria } from './ambulancias_memoria.js';
import type { EmergenciasMemoria } from './emergencias_memoria.js';

/** Aplica los efectos sobre los otros dobles, como haría la transacción real. */
export class AsignacionesMemoria extends AsignacionesRepositorio {
  readonly asignaciones = new Map<string, Asignacion>();
  readonly eventos: EventoAsignacion[] = [];

  constructor(
    private readonly ambulancias: AmbulanciasMemoria,
    private readonly emergencias: EmergenciasMemoria,
  ) {
    super();
  }

  buscarPorId(id: string): Promise<Asignacion | null> {
    return Promise.resolve(this.asignaciones.get(id) ?? null);
  }

  buscarActivaDeAmbulancia(ambulanciaId: string): Promise<Asignacion | null> {
    return Promise.resolve(
      [...this.asignaciones.values()].find(
        (a) => a.ambulanciaId === ambulanciaId && a.estaActiva(),
      ) ?? null,
    );
  }

  contarActivasDeEmergencia(
    emergenciaId: string,
    excluirId: string,
  ): Promise<number> {
    return Promise.resolve(
      [...this.asignaciones.values()].filter(
        (a) =>
          a.emergenciaId === emergenciaId &&
          a.id !== excluirId &&
          a.estaActiva(),
      ).length,
    );
  }

  listar(
    { emergenciaId, soloActivas }: FiltrosAsignaciones,
    { pagina, limite }: Paginacion,
  ): Promise<ResultadoPaginado<Asignacion>> {
    const datos = [...this.asignaciones.values()].filter(
      (a) =>
        (!emergenciaId || a.emergenciaId === emergenciaId) &&
        (!soloActivas || a.estaActiva()),
    );
    return Promise.resolve({ datos, total: datos.length, pagina, limite });
  }

  async registrarDespacho(
    asignacion: Asignacion,
    evento: EventoAsignacion,
    ambulancia: CambioAmbulancia,
    emergencia: CambioEmergencia,
  ): Promise<Asignacion> {
    this.guardarEvento(evento);
    await this.aplicar({ ambulancia, emergencia });
    this.asignaciones.set(asignacion.id, asignacion);
    return asignacion;
  }

  async registrarTransicion(
    asignacion: Asignacion,
    _estadoAnterior: EstadoAsignacion,
    evento: EventoAsignacion,
    efectos: { ambulancia?: CambioAmbulancia; emergencia?: CambioEmergencia },
  ): Promise<Asignacion> {
    this.guardarEvento(evento);
    await this.aplicar(efectos);
    this.asignaciones.set(asignacion.id, asignacion);
    return asignacion;
  }

  listarEventos(asignacionId: string): Promise<EventoAsignacion[]> {
    return Promise.resolve(
      this.eventos.filter((e) => e.asignacionId === asignacionId),
    );
  }

  /** Igual que la restricción única (asignación, estado) de la base. */
  private guardarEvento(evento: EventoAsignacion): void {
    const repetido = this.eventos.some(
      (e) =>
        e.asignacionId === evento.asignacionId &&
        e.estadoNuevo === evento.estadoNuevo,
    );
    if (repetido) throw new ConflictoNegocioError('Paso ya registrado');
    this.eventos.push(evento);
  }

  private async aplicar(efectos: {
    ambulancia?: CambioAmbulancia;
    emergencia?: CambioEmergencia;
  }): Promise<void> {
    if (efectos.ambulancia) {
      await this.ambulancias.cambiarEstado(
        efectos.ambulancia.ambulancia,
        efectos.ambulancia.cambio,
      );
    }
    if (efectos.emergencia) {
      await this.emergencias.actualizar(
        efectos.emergencia.emergencia,
        efectos.emergencia.estadoAnterior,
      );
    }
  }
}
