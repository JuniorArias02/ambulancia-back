import { Injectable } from '@nestjs/common';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { fechaColombia } from '../../../../common/utils/fecha_colombia.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import { rangoDesdeDias } from '../../domain/consulta_clinica.js';
import {
  calcularIndicadores,
  DIAS_POR_DEFECTO_INDICADORES,
  type IndicadoresClinicos,
} from '../../domain/indicadores_clinicos.js';
import { ConsultaClinicaRepositorio } from '../../domain/repositories/consulta_clinica.repository.js';

/** Tablero de la consulta clínica para un rango de días (por defecto, los últimos 30). */
@Injectable()
export class ConsultarIndicadoresClinicos {
  constructor(
    private readonly consultaRepositorio: ConsultaClinicaRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    entrada: { desde?: string; hasta?: string },
    contexto: ContextoSolicitud,
  ): Promise<IndicadoresClinicos> {
    const hoy = new Date();
    const hasta = entrada.hasta ?? fechaColombia(hoy);
    const desde =
      entrada.desde ??
      fechaColombia(
        new Date(
          new Date(`${hasta}T12:00:00Z`).getTime() -
            (DIAS_POR_DEFECTO_INDICADORES - 1) * 86_400_000,
        ),
      );
    const rango = rangoDesdeDias(desde, hasta);
    const { historias, servicios } =
      await this.consultaRepositorio.datosIndicadores(rango);
    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'consulta_clinica',
      entidadId: contexto.usuarioId ?? 'desconocido',
      accion: 'consultar_indicadores',
      detalle: { desde, hasta },
      direccionIp: contexto.direccionIp,
    });
    return calcularIndicadores({ desde, hasta }, historias, servicios);
  }
}
