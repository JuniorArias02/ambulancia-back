import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type { PuntoGeografico } from '../../../../common/utils/geografia.js';
import { AmbulanciasRepositorio } from '../../../ambulances/domain/repositories/ambulancias.repository.js';
import type {
  Asignacion,
  EstadoAsignacion,
} from '../../../assignments/domain/entities/asignacion.entity.js';
import { AsignacionesRepositorio } from '../../../assignments/domain/repositories/asignaciones.repository.js';
import type { Emergencia } from '../../../emergencies/domain/entities/emergencia.entity.js';
import { ObtenerRutaAsignacion } from '../../../routing/application/use-cases/obtener_ruta_asignacion.use-case.js';
import {
  type MotivoSinSeguimiento,
  motivoSinSeguimiento,
  vaHaciaElLugar,
  vigenciaUbicacion,
} from '../../domain/services/seguimiento_ambulancia.js';
import { ConsultarMisEmergencias } from './consultar_mis_emergencias.use-case.js';

export interface UbicacionSeguida extends PuntoGeografico {
  registradaEn: Date;
  desactualizada: boolean;
}

export interface LlegadaEstimada {
  distanciaMetros: number;
  duracionSegundos: number;
  llegadaEstimada: Date;
  geometria: readonly PuntoGeografico[];
}

export interface AmbulanciaSeguida {
  ambulanciaCodigo: string | null;
  tipoAmbulancia: string | null;
  etapa: EstadoAsignacion;
  ubicacion: UbicacionSeguida | null;
  llegada: LlegadaEstimada | null;
}

export interface SeguimientoEmergencia {
  emergencia: Emergencia;
  disponible: boolean;
  motivoNoDisponible: MotivoSinSeguimiento | null;
  ambulancias: AmbulanciaSeguida[];
  consultadoEn: Date;
}

/**
 * Lo que ve el ciudadano de las ambulancias de su propio reporte mientras van
 * hacia el lugar. Reutiliza la última posición que ya guarda cada GPS y la ruta
 * que ya calcula el backend; no expone placa, tripulación ni otras emergencias.
 */
@Injectable()
export class ObtenerSeguimientoEmergencia {
  constructor(
    private readonly consultarMisEmergencias: ConsultarMisEmergencias,
    private readonly asignacionesRepositorio: AsignacionesRepositorio,
    private readonly ambulanciasRepositorio: AmbulanciasRepositorio,
    private readonly obtenerRuta: ObtenerRutaAsignacion,
  ) {}

  async ejecutar(
    usuarioId: string,
    emergenciaId: string,
  ): Promise<SeguimientoEmergencia> {
    // Un reporte ajeno responde 404, igual que uno inexistente.
    const emergencia = await this.consultarMisEmergencias.obtener(
      usuarioId,
      emergenciaId,
    );
    const consultadoEn = new Date();
    const motivo = motivoSinSeguimiento(emergencia.estado);
    if (motivo) {
      return {
        emergencia,
        disponible: false,
        motivoNoDisponible: motivo,
        ambulancias: [],
        consultadoEn,
      };
    }

    const { datos: activas } = await this.asignacionesRepositorio.listar(
      { emergenciaId, soloActivas: true },
      { pagina: 1, limite: 20 },
    );
    const ambulancias = await Promise.all(
      activas
        .filter((asignacion) => vaHaciaElLugar(asignacion.estado))
        .map((asignacion) => this.seguir(asignacion, consultadoEn)),
    );
    return {
      emergencia,
      disponible: ambulancias.length > 0,
      motivoNoDisponible:
        ambulancias.length > 0 ? null : 'sin_ambulancia_asignada',
      ambulancias,
      consultadoEn,
    };
  }

  private async seguir(
    asignacion: Asignacion,
    ahora: Date,
  ): Promise<AmbulanciaSeguida> {
    const ambulancia = await this.ambulanciasRepositorio.buscarPorId(
      asignacion.ambulanciaId,
    );
    const ultima = ambulancia?.ultimaUbicacion ?? null;
    const vigencia = ultima
      ? vigenciaUbicacion(ultima.registradaEn, ahora)
      : null;
    return {
      ambulanciaCodigo: asignacion.ambulanciaCodigo,
      tipoAmbulancia: ambulancia?.tipo.nombre ?? null,
      etapa: asignacion.estado,
      ubicacion:
        ultima && vigencia !== 'no_visible'
          ? {
              latitud: ultima.latitud,
              longitud: ultima.longitud,
              registradaEn: ultima.registradaEn,
              desactualizada: vigencia === 'desactualizada',
            }
          : null,
      llegada: await this.llegadaAlLugar(asignacion),
    };
  }

  private async llegadaAlLugar(
    asignacion: Asignacion,
  ): Promise<LlegadaEstimada | null> {
    try {
      const { ruta } = await this.obtenerRuta.ejecutar(asignacion.id);
      return {
        distanciaMetros: ruta.distanciaMetros,
        duracionSegundos: ruta.duracionSegundos,
        llegadaEstimada: ruta.llegadaEstimada(),
        geometria: ruta.geometria,
      };
    } catch (error) {
      // Sin GPS reciente todavía no hay ruta: no es un error para el ciudadano.
      if (error instanceof RecursoNoEncontradoError) return null;
      throw error;
    }
  }
}
