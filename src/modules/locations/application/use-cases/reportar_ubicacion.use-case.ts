import { Injectable } from '@nestjs/common';
import { PublicadorEventos } from '../../../../common/events/publicador_eventos.js';
import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import { TurnosRepositorio } from '../../../ambulances/domain/repositories/turnos.repository.js';
import { AsignacionesRepositorio } from '../../../assignments/domain/repositories/asignaciones.repository.js';
import type { Ubicacion } from '../../domain/entities/ubicacion.entity.js';
import { UbicacionesRepositorio } from '../../domain/repositories/ubicaciones.repository.js';

export interface ReportarUbicacionEntrada {
  usuarioId: string;
  latitud: number;
  longitud: number;
  velocidad?: number;
  /** Hora del celular; si no viene, la del servidor. */
  registradaEn?: Date;
}

/** Tolerancia para relojes de celular adelantados. */
const TOLERANCIA_FUTURO_MS = 60_000;

/**
 * La ambulancia sale del turno activo de quien reporta: nadie puede
 * reportar la posición de una ambulancia en la que no va.
 */
@Injectable()
export class ReportarUbicacion {
  constructor(
    private readonly ubicacionesRepositorio: UbicacionesRepositorio,
    private readonly turnosRepositorio: TurnosRepositorio,
    private readonly asignacionesRepositorio: AsignacionesRepositorio,
    private readonly eventos: PublicadorEventos,
  ) {}

  async ejecutar(datos: ReportarUbicacionEntrada): Promise<Ubicacion> {
    const turno = await this.turnosRepositorio.buscarActivoDeUsuario(
      datos.usuarioId,
    );
    if (!turno) {
      throw new ReglaNegocioError(
        'No está en un turno activo; no hay ambulancia a la cual asociar la ubicación',
      );
    }

    const ahora = new Date();
    const registradaEn = datos.registradaEn ?? ahora;
    if (registradaEn.getTime() > ahora.getTime() + TOLERANCIA_FUTURO_MS) {
      throw new ReglaNegocioError('La fecha de la ubicación está en el futuro');
    }

    const asignacion =
      await this.asignacionesRepositorio.buscarActivaDeAmbulancia(
        turno.ambulanciaId,
      );
    const ubicacion: Ubicacion = {
      id: crypto.randomUUID(),
      ambulanciaId: turno.ambulanciaId,
      asignacionId: asignacion?.id ?? null,
      latitud: datos.latitud,
      longitud: datos.longitud,
      velocidad: datos.velocidad ?? null,
      registradaEn,
    };
    await this.ubicacionesRepositorio.registrar(ubicacion);
    this.eventos.publicar({
      tipo: 'ambulancia.ubicacion_actualizada',
      ambulanciaId: ubicacion.ambulanciaId,
      asignacionId: ubicacion.asignacionId,
      latitud: ubicacion.latitud,
      longitud: ubicacion.longitud,
      velocidad: ubicacion.velocidad,
      registradaEn: ubicacion.registradaEn,
    });
    return ubicacion;
  }
}
