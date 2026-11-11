import { ConflictoNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type { ChequeoDiario } from '../../domain/entities/chequeo_diario.entity.js';
import {
  ChequeosDiariosRepositorio,
  type ClaveChequeoDelDia,
  type FiltrosChequeosDiarios,
} from '../../domain/repositories/chequeos_diarios.repository.js';

export class ChequeosDiariosMemoria extends ChequeosDiariosRepositorio {
  readonly chequeos = new Map<string, ChequeoDiario>();
  /** Simula que otra solicitud finalizó el chequeo justo antes. */
  forzarConflicto = false;

  buscarPorId(id: string): Promise<ChequeoDiario | null> {
    return Promise.resolve(this.chequeos.get(id) ?? null);
  }

  buscarDelDia(clave: ClaveChequeoDelDia): Promise<ChequeoDiario | null> {
    return Promise.resolve(
      [...this.chequeos.values()].find(
        (c) =>
          c.listaChequeoId === clave.listaChequeoId &&
          c.conductorId === clave.conductorId &&
          c.ambulanciaId === clave.ambulanciaId &&
          c.fecha === clave.fecha,
      ) ?? null,
    );
  }

  /** Igual que el índice único `uk_chequeo_diario`. */
  async crear(
    chequeo: ChequeoDiario,
  ): Promise<{ chequeo: ChequeoDiario; creado: boolean }> {
    const existente = await this.buscarDelDia({
      listaChequeoId: chequeo.listaChequeoId,
      conductorId: chequeo.conductorId,
      ambulanciaId: chequeo.ambulanciaId,
      fecha: chequeo.fecha,
    });
    if (existente) return { chequeo: existente, creado: false };
    this.chequeos.set(chequeo.id, chequeo);
    return { chequeo, creado: true };
  }

  guardarRespuestas(chequeo: ChequeoDiario): Promise<ChequeoDiario> {
    return this.guardarSiEsBorrador(chequeo);
  }

  finalizar(chequeo: ChequeoDiario): Promise<ChequeoDiario> {
    return this.guardarSiEsBorrador(chequeo);
  }

  listar(
    filtros: FiltrosChequeosDiarios,
    { pagina, limite }: Paginacion,
  ): Promise<ResultadoPaginado<ChequeoDiario>> {
    const datos = [...this.chequeos.values()].filter(
      (c) =>
        (!filtros.conductorId || c.conductorId === filtros.conductorId) &&
        (!filtros.ambulanciaId || c.ambulanciaId === filtros.ambulanciaId),
    );
    return Promise.resolve({ datos, total: datos.length, pagina, limite });
  }

  private guardarSiEsBorrador(chequeo: ChequeoDiario): Promise<ChequeoDiario> {
    if (this.forzarConflicto) {
      return Promise.reject(
        new ConflictoNegocioError('El chequeo ya fue finalizado'),
      );
    }
    this.chequeos.set(chequeo.id, chequeo);
    return Promise.resolve(chequeo);
  }
}
