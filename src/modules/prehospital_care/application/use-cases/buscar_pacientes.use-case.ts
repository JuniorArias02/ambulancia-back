import { Injectable } from '@nestjs/common';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import type { ResultadoPaginado } from '../../../../common/types/resultado_paginado.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import {
  normalizarDocumento,
  palabrasDeNombre,
} from '../../domain/consulta_clinica.js';
import type { PacienteResumen } from '../../domain/pacientes.js';
import { ConsultaClinicaRepositorio } from '../../domain/repositories/consulta_clinica.repository.js';

/** Índice de pacientes: por documento o por nombre. Auditado sin los valores buscados. */
@Injectable()
export class BuscarPacientes {
  constructor(
    private readonly consultaRepositorio: ConsultaClinicaRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    entrada: {
      documento?: string;
      nombre?: string;
      pagina: number;
      limite: number;
    },
    contexto: ContextoSolicitud,
  ): Promise<ResultadoPaginado<PacienteResumen>> {
    const documento = entrada.documento?.trim()
      ? normalizarDocumento(entrada.documento)
      : undefined;
    const palabras = palabrasDeNombre(entrada.nombre);
    const resultado = await this.consultaRepositorio.buscarPacientes({
      documento,
      palabrasNombre: palabras.length > 0 ? palabras : undefined,
      pagina: entrada.pagina,
      limite: entrada.limite,
    });
    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'consulta_clinica',
      entidadId: contexto.usuarioId ?? 'desconocido',
      accion: 'buscar_pacientes',
      detalle: {
        filtros: [
          ...(documento ? ['documento'] : []),
          ...(palabras.length > 0 ? ['nombre'] : []),
        ],
        resultados: resultado.total,
      },
      direccionIp: contexto.direccionIp,
    });
    return resultado;
  }
}
