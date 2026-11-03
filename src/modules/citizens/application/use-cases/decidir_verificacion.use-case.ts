import { Injectable } from '@nestjs/common';
import { NoAutenticadoError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type { DecisionVerificacion } from '../../domain/entities/verificacion_identidad.entity.js';
import { CiudadanosRepositorio } from '../../domain/repositories/ciudadanos.repository.js';
import { ObtenerCiudadano } from './obtener_ciudadano.use-case.js';
import {
  type DetalleVerificacion,
  ObtenerVerificacion,
} from './obtener_verificacion.use-case.js';

export interface DecidirVerificacionEntrada {
  usuarioId: string;
  decision: DecisionVerificacion;
  motivo?: string;
  observaciones?: string;
}

/**
 * Revisión documental interna del administrador: aprobar no certifica la
 * identidad ante terceros, solo habilita los reportes en la plataforma.
 */
@Injectable()
export class DecidirVerificacion {
  constructor(
    private readonly obtenerCiudadano: ObtenerCiudadano,
    private readonly ciudadanosRepositorio: CiudadanosRepositorio,
    private readonly obtenerVerificacion: ObtenerVerificacion,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    datos: DecidirVerificacionEntrada,
    contexto: ContextoSolicitud,
  ): Promise<DetalleVerificacion> {
    const revisorId = contexto.usuarioId;
    if (!revisorId) throw new NoAutenticadoError();
    const ciudadano = await this.obtenerCiudadano.ejecutar(datos.usuarioId);
    const cambio = ciudadano.verificacion.decidir({
      decision: datos.decision,
      motivo: datos.motivo,
      observaciones: datos.observaciones,
      revisorId,
      fecha: new Date(),
    });
    await this.ciudadanosRepositorio.registrarDecision(ciudadano, cambio);

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'verificaciones_identidad',
      entidadId: ciudadano.verificacion.id,
      accion: 'decidir',
      detalle: {
        ciudadanoId: ciudadano.id,
        estadoAnterior: cambio.estadoAnterior,
        estadoNuevo: cambio.estadoNuevo,
        motivo: cambio.motivo,
      },
      direccionIp: contexto.direccionIp,
    });
    return this.obtenerVerificacion.ejecutar(ciudadano.id, contexto);
  }
}
