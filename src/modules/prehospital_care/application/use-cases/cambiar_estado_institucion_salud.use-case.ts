import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type { InstitucionSalud } from '../../domain/entities/institucion_salud.entity.js';
import { InstitucionesSaludRepositorio } from '../../domain/repositories/instituciones_salud.repository.js';

@Injectable()
export class CambiarEstadoInstitucionSalud {
  constructor(
    private readonly institucionesRepositorio: InstitucionesSaludRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    institucionId: string,
    activa: boolean,
    contexto: ContextoSolicitud,
  ): Promise<InstitucionSalud> {
    const institucion =
      await this.institucionesRepositorio.buscarPorId(institucionId);
    if (!institucion)
      throw new RecursoNoEncontradoError('Institución de salud');

    institucion.cambiarEstado(activa);
    const actualizada =
      await this.institucionesRepositorio.actualizar(institucion);

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'instituciones_salud',
      entidadId: institucion.id,
      accion: activa ? 'activar' : 'inactivar',
      direccionIp: contexto.direccionIp,
    });
    return actualizada;
  }
}
