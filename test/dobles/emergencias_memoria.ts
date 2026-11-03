import type {
  Paginacion,
  ResultadoPaginado,
} from '../../src/common/types/resultado_paginado.js';
import { ConflictoNegocioError } from '../../src/common/exceptions/errores_dominio.js';
import {
  Emergencia,
  type DatosNuevaEmergencia,
  type EstadoEmergencia,
} from '../../src/modules/emergencies/domain/entities/emergencia.entity.js';
import {
  EmergenciasRepositorio,
  type FiltrosEmergencias,
  NumeroEmergenciaEnUsoError,
} from '../../src/modules/emergencies/domain/repositories/emergencias.repository.js';

export class EmergenciasMemoria extends EmergenciasRepositorio {
  readonly emergencias = new Map<string, Emergencia>();
  /** Simula que otra solicitud tomó el número en las próximas N creaciones. */
  colisionesPendientes = 0;

  buscarPorId(id: string): Promise<Emergencia | null> {
    return Promise.resolve(this.emergencias.get(id) ?? null);
  }

  ultimoConsecutivo(prefijo: string): Promise<number> {
    const consecutivos = [...this.emergencias.values()]
      .map((e) => e.numeroEmergencia)
      .filter((numero) => numero.startsWith(prefijo))
      .map((numero) => Number(numero.slice(prefijo.length)));
    return Promise.resolve(Math.max(0, ...consecutivos));
  }

  /** Solo aplica el filtro por informante, que es el que protege los reportes ajenos. */
  listar(
    { informanteUsuarioId }: FiltrosEmergencias,
    { pagina, limite }: Paginacion,
  ): Promise<ResultadoPaginado<Emergencia>> {
    const datos = [...this.emergencias.values()].filter(
      (e) =>
        !informanteUsuarioId || e.informanteUsuarioId === informanteUsuarioId,
    );
    return Promise.resolve({ datos, total: datos.length, pagina, limite });
  }

  crear(emergencia: Emergencia): Promise<Emergencia> {
    if (this.colisionesPendientes > 0) {
      this.colisionesPendientes--;
      return Promise.reject(new NumeroEmergenciaEnUsoError());
    }
    this.emergencias.set(emergencia.id, emergencia);
    return Promise.resolve(emergencia);
  }

  actualizar(
    emergencia: Emergencia,
    _estadoEsperado: EstadoEmergencia,
  ): Promise<Emergencia> {
    if (!this.emergencias.has(emergencia.id)) {
      return Promise.reject(new ConflictoNegocioError('No existe'));
    }
    this.emergencias.set(emergencia.id, emergencia);
    return Promise.resolve(emergencia);
  }

  listarActivasDesde(desde: Date, excluirId: string): Promise<Emergencia[]> {
    return Promise.resolve(
      [...this.emergencias.values()].filter(
        (e) =>
          e.id !== excluirId &&
          e.estaActiva() &&
          !e.esDuplicada() &&
          e.recibidaEn >= desde,
      ),
    );
  }
}

let consecutivoPrueba = 0;

export function crearEmergenciaPrueba(
  cambios: Partial<DatosNuevaEmergencia> = {},
): Emergencia {
  consecutivoPrueba++;
  return Emergencia.crear({
    numeroEmergencia: `EMG-20261024-${String(consecutivoPrueba).padStart(4, '0')}`,
    fuente: 'linea_123',
    descripcion: 'Choque entre moto y carro',
    tipoIncidente: 'accidente_transito',
    direccion: 'Calle 72 # 15-20',
    recibidaPorId: 'despachador-1',
    recibidaEn: new Date(),
    ...cambios,
  });
}
