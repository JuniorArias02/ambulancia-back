import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type { FichaPaciente } from '../../domain/pacientes.js';
import { ConsultaClinicaRepositorio } from '../../domain/repositories/consulta_clinica.repository.js';

/** Ficha del paciente: sus atenciones, alergias y antecedentes reunidos y el último riesgo de caída. Auditada. */
@Injectable()
export class ObtenerFichaPaciente {
  constructor(
    private readonly consultaRepositorio: ConsultaClinicaRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    pacienteId: string,
    contexto: ContextoSolicitud,
  ): Promise<FichaPaciente> {
    const ficha = await this.consultaRepositorio.fichaPaciente(pacienteId);
    if (!ficha) throw new RecursoNoEncontradoError('Paciente');
    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'pacientes',
      entidadId: pacienteId,
      accion: 'consultar_ficha',
      detalle: { atenciones: ficha.atenciones.length },
      direccionIp: contexto.direccionIp,
    });
    return ficha;
  }
}
