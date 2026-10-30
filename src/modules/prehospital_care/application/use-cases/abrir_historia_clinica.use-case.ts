import { Injectable } from '@nestjs/common';
import {
  ConflictoNegocioError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { diaColombia } from '../../../../common/utils/fecha_colombia.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import {
  type DatosEditablesHistoria,
  HistoriaClinica,
} from '../../domain/entities/historia_clinica.entity.js';
import {
  type DetalleHistoria,
  HistoriasClinicasRepositorio,
  NumeroHistoriaEnUsoError,
} from '../../domain/repositories/historias_clinicas.repository.js';
import { AccesoHistoriaClinica } from '../services/acceso_historia_clinica.service.js';

export interface AbrirHistoriaEntrada {
  /** Generado en el celular para poder trabajar sin señal; si no viene, lo genera el servidor. */
  id?: string;
  asignacionId: string;
  /** Hora en que se abrió en el celular (puede ser antes de sincronizar). */
  abiertaEn?: Date;
  datosIniciales?: DatosEditablesHistoria;
}

export interface HistoriaAbierta {
  detalle: DetalleHistoria;
  /** false: ya existía con ese id (reintento desde el celular) y se devolvió sin cambios. */
  creada: boolean;
}

const INTENTOS_NUMERO = 3;
const TOLERANCIA_FUTURO_MS = 60_000;

/** Una historia por paciente: un servicio con varias víctimas tiene varias historias. */
@Injectable()
export class AbrirHistoriaClinica {
  constructor(
    private readonly historiasRepositorio: HistoriasClinicasRepositorio,
    private readonly acceso: AccesoHistoriaClinica,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    datos: AbrirHistoriaEntrada,
    contexto: ContextoSolicitud,
  ): Promise<HistoriaAbierta> {
    const asignacion = await this.acceso.buscarAsignacion(datos.asignacionId);
    await this.acceso.exigirTripulacionClinica(asignacion, contexto.usuarioId);

    if (datos.id) {
      const existente = await this.historiasRepositorio.buscarPorId(datos.id);
      if (existente) {
        // Reintento del celular (sin señal, doble envío): misma historia, sin duplicar.
        const detalle = await this.historiasRepositorio.buscarDetalle(
          existente.id,
        );
        if (existente.asignacionId === asignacion.id && detalle)
          return { detalle, creada: false };
        throw new ConflictoNegocioError(
          'Ya existe una historia clínica con ese id',
        );
      }
    }
    if (asignacion.estado === 'cancelada') {
      throw new ReglaNegocioError(
        'No se puede abrir una historia en un servicio cancelado',
      );
    }

    const ahora = new Date();
    const abiertaEn = datos.abiertaEn ?? ahora;
    if (abiertaEn.getTime() > ahora.getTime() + TOLERANCIA_FUTURO_MS) {
      throw new ReglaNegocioError('La fecha de apertura está en el futuro');
    }
    const id = datos.id ?? crypto.randomUUID();
    const dia = diaColombia(abiertaEn);

    for (let intento = 1; ; intento++) {
      const consecutivo =
        (await this.historiasRepositorio.ultimoConsecutivo(`HC-${dia}-`)) + 1;
      const nueva = HistoriaClinica.abrir({
        id,
        numeroHistoria: HistoriaClinica.formatearNumero(dia, consecutivo),
        emergenciaId: asignacion.emergenciaId,
        asignacionId: asignacion.id,
        creadaPorId: contexto.usuarioId ?? '',
        abiertaEn,
        sincronizadaEn: ahora,
        datosIniciales: datos.datosIniciales,
      });
      try {
        const historia = await this.historiasRepositorio.crear(nueva);
        // Sin datos clínicos en la auditoría: solo identificadores.
        await this.auditoria.registrar({
          usuarioId: contexto.usuarioId,
          entidad: 'historias_clinicas',
          entidadId: historia.id,
          accion: 'abrir',
          detalle: {
            numeroHistoria: historia.numeroHistoria,
            asignacionId: asignacion.id,
          },
          direccionIp: contexto.direccionIp,
        });
        return {
          detalle: {
            historia,
            signosVitales: [],
            lesiones: [],
            intervenciones: [],
          },
          creada: true,
        };
      } catch (error) {
        if (
          error instanceof NumeroHistoriaEnUsoError &&
          intento < INTENTOS_NUMERO
        )
          continue;
        if (error instanceof NumeroHistoriaEnUsoError) {
          throw new ConflictoNegocioError(
            'No se pudo asignar un número de historia; intente de nuevo',
          );
        }
        throw error;
      }
    }
  }
}
