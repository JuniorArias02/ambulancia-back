import { Injectable } from '@nestjs/common';
import { ConflictoNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import {
  type DatosInstitucionSalud,
  InstitucionSalud,
} from '../../domain/entities/institucion_salud.entity.js';
import { InstitucionesSaludRepositorio } from '../../domain/repositories/instituciones_salud.repository.js';

export type CrearInstitucionSaludEntrada = DatosInstitucionSalud & {
  nombre: string;
};

@Injectable()
export class CrearInstitucionSalud {
  constructor(
    private readonly institucionesRepositorio: InstitucionesSaludRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    datos: CrearInstitucionSaludEntrada,
    contexto: ContextoSolicitud,
  ): Promise<InstitucionSalud> {
    const nueva = InstitucionSalud.crear(datos);
    if (
      nueva.codigoHabilitacion &&
      (await this.institucionesRepositorio.existeCodigoHabilitacion(
        nueva.codigoHabilitacion,
      ))
    ) {
      throw new ConflictoNegocioError(
        'Ya existe una institución con ese código de habilitación',
      );
    }
    const institucion = await this.institucionesRepositorio.crear(nueva);

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'instituciones_salud',
      entidadId: institucion.id,
      accion: 'crear',
      detalle: { nombre: institucion.nombre },
      direccionIp: contexto.direccionIp,
    });
    return institucion;
  }
}
