import { Injectable } from '@nestjs/common';
import { ConflictoNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import { Ciudadano } from '../../domain/entities/ciudadano.entity.js';
import { CiudadanosRepositorio } from '../../domain/repositories/ciudadanos.repository.js';
import { ObtenerCiudadano } from './obtener_ciudadano.use-case.js';

export interface ActualizarContactoEntrada {
  correo?: string;
  telefono?: string;
}

/** Solo datos de contacto; la identidad se corrige con un reenvío de la verificación. */
@Injectable()
export class ActualizarContactoCiudadano {
  constructor(
    private readonly obtenerCiudadano: ObtenerCiudadano,
    private readonly ciudadanosRepositorio: CiudadanosRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    datos: ActualizarContactoEntrada,
    contexto: ContextoSolicitud,
  ): Promise<Ciudadano> {
    const ciudadano = await this.obtenerCiudadano.ejecutar(contexto.usuarioId);
    if (
      datos.correo !== undefined &&
      (await this.ciudadanosRepositorio.existeCorreo(
        Ciudadano.normalizarCorreo(datos.correo),
        ciudadano.id,
      ))
    ) {
      throw new ConflictoNegocioError('Ese correo ya está registrado');
    }

    ciudadano.actualizarContacto(datos);
    const actualizado =
      await this.ciudadanosRepositorio.actualizarContacto(ciudadano);
    await this.auditoria.registrar({
      usuarioId: ciudadano.id,
      entidad: 'usuarios',
      entidadId: ciudadano.id,
      accion: 'actualizar_contacto',
      detalle: {
        campos: Object.entries(datos)
          .filter(([, valor]) => valor !== undefined)
          .map(([campo]) => campo),
      },
      direccionIp: contexto.direccionIp,
    });
    return actualizado;
  }
}
