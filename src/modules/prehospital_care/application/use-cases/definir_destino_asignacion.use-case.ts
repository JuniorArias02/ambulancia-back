import { Injectable } from '@nestjs/common';
import { PublicadorEventos } from '../../../../common/events/publicador_eventos.js';
import {
  AccesoDenegadoError,
  RecursoNoEncontradoError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import {
  PermisoServicio,
  type Solicitante,
} from '../../../assignments/application/services/permiso_servicio.service.js';
import type { Asignacion } from '../../../assignments/domain/entities/asignacion.entity.js';
import { AsignacionesRepositorio } from '../../../assignments/domain/repositories/asignaciones.repository.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import { InstitucionesSaludRepositorio } from '../../domain/repositories/instituciones_salud.repository.js';

/**
 * El conductor elige o cambia el hospital al que va la ambulancia. Es independiente
 * de la historia clínica, donde queda la entrega real de cada paciente. El módulo de
 * rutas escucha `asignacion.actualizada` y recalcula si hace falta.
 */
@Injectable()
export class DefinirDestinoAsignacion {
  constructor(
    private readonly asignacionesRepositorio: AsignacionesRepositorio,
    private readonly institucionesRepositorio: InstitucionesSaludRepositorio,
    private readonly permisoServicio: PermisoServicio,
    private readonly auditoria: AuditoriaRepositorio,
    private readonly eventos: PublicadorEventos,
  ) {}

  async ejecutar(
    asignacionId: string,
    institucionId: string,
    solicitante: Solicitante,
    contexto: ContextoSolicitud,
  ): Promise<Asignacion> {
    const usuarioId = solicitante.usuarioId;
    if (!usuarioId) throw new AccesoDenegadoError('Sesión sin usuario');

    const asignacion =
      await this.asignacionesRepositorio.buscarPorId(asignacionId);
    if (!asignacion) throw new RecursoNoEncontradoError('Asignación');
    await this.permisoServicio.exigirConductor(
      asignacion,
      solicitante,
      'definir el hospital de destino',
    );
    asignacion.exigirDestinoEditable();

    const anterior = asignacion.destino;
    // Un reintento no recalcula la ruta ni deja otro registro.
    if (anterior?.institucionId === institucionId) return asignacion;

    const institucion =
      await this.institucionesRepositorio.buscarPorId(institucionId);
    if (!institucion)
      throw new RecursoNoEncontradoError('Institución de salud');
    if (!institucion.activa) {
      throw new ReglaNegocioError(`${institucion.nombre} está inactiva`);
    }
    if (!institucion.coordenadas) {
      throw new ReglaNegocioError(
        `${institucion.nombre} no tiene coordenadas; no se puede trazar la ruta`,
      );
    }

    asignacion.definirDestino(
      {
        institucionId: institucion.id,
        nombre: institucion.nombre,
        direccion: institucion.direccion,
        telefono: institucion.telefono,
        coordenadas: institucion.coordenadas,
      },
      usuarioId,
      new Date(),
    );
    const actualizada =
      await this.asignacionesRepositorio.registrarDestino(asignacion);

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'asignaciones_servicio',
      entidadId: asignacionId,
      accion: 'definir_destino',
      detalle: {
        estadoAsignacion: actualizada.estado,
        institucionAnteriorId: anterior?.institucionId ?? null,
        institucionAnterior: anterior?.nombre ?? null,
        institucionNuevaId: institucion.id,
        institucionNueva: institucion.nombre,
      },
      direccionIp: contexto.direccionIp,
    });
    this.eventos.publicar({ tipo: 'asignacion.actualizada', asignacionId });

    return actualizada;
  }
}
