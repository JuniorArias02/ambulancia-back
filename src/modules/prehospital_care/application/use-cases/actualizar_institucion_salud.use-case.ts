import { Injectable } from '@nestjs/common';
import {
  ConflictoNegocioError,
  RecursoNoEncontradoError,
} from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type {
  DatosInstitucionSalud,
  InstitucionSalud,
} from '../../domain/entities/institucion_salud.entity.js';
import { InstitucionesSaludRepositorio } from '../../domain/repositories/instituciones_salud.repository.js';

@Injectable()
export class ActualizarInstitucionSalud {
  constructor(
    private readonly institucionesRepositorio: InstitucionesSaludRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    institucionId: string,
    datos: DatosInstitucionSalud,
    contexto: ContextoSolicitud,
  ): Promise<InstitucionSalud> {
    const institucion =
      await this.institucionesRepositorio.buscarPorId(institucionId);
    if (!institucion)
      throw new RecursoNoEncontradoError('Institución de salud');

    institucion.actualizar(datos);
    if (
      institucion.codigoHabilitacion &&
      (await this.institucionesRepositorio.existeCodigoHabilitacion(
        institucion.codigoHabilitacion,
        institucion.id,
      ))
    ) {
      throw new ConflictoNegocioError(
        'Ya existe una institución con ese código de habilitación',
      );
    }
    const actualizada =
      await this.institucionesRepositorio.actualizar(institucion);

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'instituciones_salud',
      entidadId: institucion.id,
      accion: 'actualizar',
      detalle: {
        campos: Object.entries(datos)
          .filter(([, valor]) => valor !== undefined)
          .map(([campo]) => campo),
      },
      direccionIp: contexto.direccionIp,
    });
    return actualizada;
  }
}
