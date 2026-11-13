import { ConflictoNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type { Verificacion } from '../../domain/entities/verificacion.entity.js';
import {
  type FiltrosVerificaciones,
  VerificacionesRepositorio,
} from '../../domain/repositories/verificaciones.repository.js';

export class VerificacionesMemoria extends VerificacionesRepositorio {
  readonly verificaciones = new Map<string, Verificacion>();
  /** Ids que "otra solicitud" ya revisó en la base. */
  readonly revisadasPorOtro = new Set<string>();

  buscarPorId(id: string): Promise<Verificacion | null> {
    return Promise.resolve(this.verificaciones.get(id) ?? null);
  }

  buscarBorradorDeUbicacion(ubicacionId: string): Promise<Verificacion | null> {
    return Promise.resolve(
      [...this.verificaciones.values()].find(
        (v) => v.ubicacionId === ubicacionId && v.estaEnBorrador(),
      ) ?? null,
    );
  }

  crear(
    verificacion: Verificacion,
  ): Promise<{ verificacion: Verificacion; creada: boolean }> {
    this.verificaciones.set(verificacion.id, verificacion);
    return Promise.resolve({ verificacion, creada: true });
  }

  guardarConteos(verificacion: Verificacion): Promise<Verificacion> {
    this.verificaciones.set(verificacion.id, verificacion);
    return Promise.resolve(verificacion);
  }

  finalizar(verificacion: Verificacion): Promise<Verificacion> {
    this.verificaciones.set(verificacion.id, verificacion);
    return Promise.resolve(verificacion);
  }

  revisar(verificacion: Verificacion): Promise<Verificacion> {
    if (this.revisadasPorOtro.has(verificacion.id)) {
      return Promise.reject(
        new ConflictoNegocioError(
          'La verificación ya fue revisada; vuelva a consultarla',
        ),
      );
    }
    this.verificaciones.set(verificacion.id, verificacion);
    return Promise.resolve(verificacion);
  }

  listar(
    filtros: FiltrosVerificaciones,
    { pagina, limite }: Paginacion,
  ): Promise<ResultadoPaginado<Verificacion>> {
    const datos = [...this.verificaciones.values()].filter(
      (v) =>
        filtros.revisada === undefined ||
        (v.estado === 'con_novedades' &&
          (v.revision !== null) === filtros.revisada),
    );
    return Promise.resolve({ datos, total: datos.length, pagina, limite });
  }
}
