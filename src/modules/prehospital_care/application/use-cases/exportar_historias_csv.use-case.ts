import { Injectable } from '@nestjs/common';
import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { fechaColombia } from '../../../../common/utils/fecha_colombia.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import { filtrosUsados } from '../../domain/consulta_clinica.js';
import {
  historiasACsv,
  MAXIMO_FILAS_EXPORTACION,
} from '../../domain/indicadores_clinicos.js';
import { ConsultaClinicaRepositorio } from '../../domain/repositories/consulta_clinica.repository.js';
import {
  armarFiltrosBusqueda,
  type BuscarHistoriasEntrada,
} from './buscar_historias_clinicas.use-case.js';

/**
 * Exporta a CSV (Excel) el resultado de la búsqueda, con los mismos filtros
 * de la bandeja. Solo el administrador; queda auditado con los filtros
 * usados (sin sus valores) y el número de filas.
 */
@Injectable()
export class ExportarHistoriasCsv {
  constructor(
    private readonly consultaRepositorio: ConsultaClinicaRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    entrada: Omit<BuscarHistoriasEntrada, 'pagina' | 'limite'>,
    contexto: ContextoSolicitud,
  ): Promise<{ nombreArchivo: string; contenido: string }> {
    const filtros = armarFiltrosBusqueda({
      ...entrada,
      pagina: 1,
      // Una de más para saber si se pasó del máximo.
      limite: MAXIMO_FILAS_EXPORTACION + 1,
    });
    const { datos } = await this.consultaRepositorio.buscarHistorias(filtros);
    if (datos.length > MAXIMO_FILAS_EXPORTACION) {
      throw new ReglaNegocioError(
        `Hay más de ${MAXIMO_FILAS_EXPORTACION} historias con esos filtros: acote la búsqueda (por ejemplo, el rango de fechas)`,
      );
    }
    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'consulta_clinica',
      entidadId: contexto.usuarioId ?? 'desconocido',
      accion: 'exportar_historias',
      detalle: { filtros: filtrosUsados(filtros), filas: datos.length },
      direccionIp: contexto.direccionIp,
    });
    return {
      nombreArchivo: `historias-clinicas-${fechaColombia(new Date())}.csv`,
      contenido: historiasACsv(datos),
    };
  }
}
