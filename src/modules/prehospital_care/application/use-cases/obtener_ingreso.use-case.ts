import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type { IngresoServicio } from '../../domain/consulta_clinica.js';
import { ConsultaClinicaRepositorio } from '../../domain/repositories/consulta_clinica.repository.js';

/**
 * El ingreso o servicio completo: la solicitud, cada ambulancia con su
 * tripulación, la línea de tiempo y los tiempos, el recorrido, los insumos
 * y todas las historias de los pacientes. Consulta auditada.
 */
@Injectable()
export class ObtenerIngreso {
  constructor(
    private readonly consultaRepositorio: ConsultaClinicaRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    numeroOId: string,
    contexto: ContextoSolicitud,
  ): Promise<IngresoServicio> {
    const ingreso = await this.consultaRepositorio.obtenerIngreso(
      numeroOId.trim(),
    );
    if (!ingreso) throw new RecursoNoEncontradoError('Ingreso');
    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'emergencias',
      entidadId: ingreso.emergencia.id,
      accion: 'consultar_ingreso',
      detalle: {
        numeroEmergencia: ingreso.emergencia.numeroEmergencia,
        historias: ingreso.historias.length,
      },
      direccionIp: contexto.direccionIp,
    });
    return ingreso;
  }
}
