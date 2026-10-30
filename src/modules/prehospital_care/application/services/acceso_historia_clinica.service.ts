import { Injectable } from '@nestjs/common';
import { Roles, type NombreRol } from '../../../../common/constants/roles.js';
import {
  AccesoDenegadoError,
  RecursoNoEncontradoError,
} from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { TurnosRepositorio } from '../../../ambulances/domain/repositories/turnos.repository.js';
import type { Asignacion } from '../../../assignments/domain/entities/asignacion.entity.js';
import { AsignacionesRepositorio } from '../../../assignments/domain/repositories/asignaciones.repository.js';
import type { HistoriaClinica } from '../../domain/entities/historia_clinica.entity.js';
import { HistoriasClinicasRepositorio } from '../../domain/repositories/historias_clinicas.repository.js';

export interface Solicitante {
  usuarioId: string | null;
  rol: NombreRol;
}

/** Quien atiende al paciente: paramédico o médico dentro del turno. El conductor no. */
const FUNCIONES_CLINICAS: readonly string[] = ['paramedico', 'medico'];

/**
 * Los datos clínicos solo los ven quienes atienden al paciente y, para
 * control, el administrador (arquitectura.md §7 y §9). El despachador y el
 * conductor no tienen acceso.
 */
@Injectable()
export class AccesoHistoriaClinica {
  constructor(
    private readonly historiasRepositorio: HistoriasClinicasRepositorio,
    private readonly asignacionesRepositorio: AsignacionesRepositorio,
    private readonly turnosRepositorio: TurnosRepositorio,
  ) {}

  async exigirTripulacionClinica(
    asignacion: Asignacion,
    usuarioId: string | null,
  ): Promise<void> {
    const turno = asignacion.turnoId
      ? await this.turnosRepositorio.buscarPorId(asignacion.turnoId)
      : null;
    const funcion = turno?.integrantes.find(
      (i) => i.usuarioId === usuarioId,
    )?.funcion;
    if (!usuarioId || !funcion || !FUNCIONES_CLINICAS.includes(funcion)) {
      throw new AccesoDenegadoError(
        'Solo el paramédico o el médico de la ambulancia asignada puede gestionar esta historia clínica',
      );
    }
  }

  async exigirLecturaDeAsignacion(
    asignacionId: string,
    solicitante: Solicitante,
  ): Promise<void> {
    if (solicitante.rol === Roles.ADMINISTRADOR) return;
    await this.exigirTripulacionClinica(
      await this.buscarAsignacion(asignacionId),
      solicitante.usuarioId,
    );
  }

  /** Carga una historia que se va a modificar: debe existir, ser de su tripulación y seguir en borrador. */
  async cargarParaEditar(
    historiaId: string,
    contexto: ContextoSolicitud,
  ): Promise<HistoriaClinica> {
    const historia = await this.buscarHistoria(historiaId);
    await this.exigirTripulacionDeHistoria(historia, contexto.usuarioId);
    historia.exigirBorrador();
    return historia;
  }

  async exigirLectura(
    historia: HistoriaClinica,
    solicitante: Solicitante,
  ): Promise<void> {
    if (solicitante.rol === Roles.ADMINISTRADOR) return;
    await this.exigirTripulacionDeHistoria(historia, solicitante.usuarioId);
  }

  async buscarHistoria(id: string): Promise<HistoriaClinica> {
    const historia = await this.historiasRepositorio.buscarPorId(id);
    if (!historia) throw new RecursoNoEncontradoError('Historia clínica');
    return historia;
  }

  async buscarAsignacion(id: string): Promise<Asignacion> {
    const asignacion = await this.asignacionesRepositorio.buscarPorId(id);
    if (!asignacion) throw new RecursoNoEncontradoError('Asignación');
    return asignacion;
  }

  private async exigirTripulacionDeHistoria(
    historia: HistoriaClinica,
    usuarioId: string | null,
  ): Promise<void> {
    if (!historia.asignacionId) {
      throw new AccesoDenegadoError(
        'La historia clínica no está asociada a un servicio',
      );
    }
    await this.exigirTripulacionClinica(
      await this.buscarAsignacion(historia.asignacionId),
      usuarioId,
    );
  }
}
