import { Injectable } from '@nestjs/common';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type { Ciudadano } from '../../domain/entities/ciudadano.entity.js';
import {
  CiudadanosRepositorio,
  type RegistroHistorialVerificacion,
} from '../../domain/repositories/ciudadanos.repository.js';
import { ObtenerCiudadano } from './obtener_ciudadano.use-case.js';

export interface DetalleVerificacion {
  ciudadano: Ciudadano;
  historial: RegistroHistorialVerificacion[];
}

/** Cada consulta de los datos de identidad queda en la auditoría. */
@Injectable()
export class ObtenerVerificacion {
  constructor(
    private readonly obtenerCiudadano: ObtenerCiudadano,
    private readonly ciudadanosRepositorio: CiudadanosRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    usuarioId: string,
    contexto: ContextoSolicitud,
  ): Promise<DetalleVerificacion> {
    const ciudadano = await this.obtenerCiudadano.ejecutar(usuarioId);
    const historial =
      await this.ciudadanosRepositorio.listarHistorial(usuarioId);
    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'verificaciones_identidad',
      entidadId: ciudadano.verificacion.id,
      accion: 'consultar',
      direccionIp: contexto.direccionIp,
    });
    return { ciudadano, historial };
  }
}
