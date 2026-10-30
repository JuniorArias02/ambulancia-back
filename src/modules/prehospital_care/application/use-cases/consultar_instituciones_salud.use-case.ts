import { Injectable } from '@nestjs/common';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import {
  distanciaMetros,
  type PuntoGeografico,
} from '../../../../common/utils/geografia.js';
import type { InstitucionSalud } from '../../domain/entities/institucion_salud.entity.js';
import {
  type FiltrosInstituciones,
  InstitucionesSaludRepositorio,
} from '../../domain/repositories/instituciones_salud.repository.js';

export interface InstitucionConDistancia {
  institucion: InstitucionSalud;
  /** null si no se envió punto de referencia o la institución no tiene coordenadas. */
  distanciaMetros: number | null;
}

@Injectable()
export class ConsultarInstitucionesSalud {
  constructor(
    private readonly institucionesRepositorio: InstitucionesSaludRepositorio,
  ) {}

  /**
   * Con `cercaDe` se ordenan de la más cercana a la más lejana (para elegir
   * el destino del traslado); las que no tienen coordenadas van al final.
   * Sin `cercaDe`, por nombre.
   */
  async ejecutar(
    filtros: FiltrosInstituciones,
    paginacion: Paginacion,
    cercaDe?: PuntoGeografico,
  ): Promise<ResultadoPaginado<InstitucionConDistancia>> {
    if (!cercaDe) {
      const resultado = await this.institucionesRepositorio.listar(
        filtros,
        paginacion,
      );
      return {
        ...resultado,
        datos: resultado.datos.map((institucion) => ({
          institucion,
          distanciaMetros: null,
        })),
      };
    }

    const todas = await this.institucionesRepositorio.listarTodas(filtros);
    const ordenadas = todas
      .map((institucion) => ({
        institucion,
        distanciaMetros: institucion.coordenadas
          ? Math.round(distanciaMetros(cercaDe, institucion.coordenadas))
          : null,
      }))
      .sort(
        (a, b) =>
          (a.distanciaMetros ?? Number.MAX_SAFE_INTEGER) -
          (b.distanciaMetros ?? Number.MAX_SAFE_INTEGER),
      );
    const inicio = (paginacion.pagina - 1) * paginacion.limite;
    return {
      datos: ordenadas.slice(inicio, inicio + paginacion.limite),
      total: ordenadas.length,
      pagina: paginacion.pagina,
      limite: paginacion.limite,
    };
  }
}
