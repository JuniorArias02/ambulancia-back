import { Injectable, Logger } from '@nestjs/common';
import { PublicadorEventos } from '../../../../common/events/publicador_eventos.js';
import { FallaProveedorExterno } from '../../../../common/exceptions/falla_proveedor_externo.js';
import { ConsultasEnCurso } from '../../../../common/utils/consultas_en_curso.js';
import type { PuntoGeografico } from '../../../../common/utils/geografia.js';
import { AmbulanciasRepositorio } from '../../../ambulances/domain/repositories/ambulancias.repository.js';
import type { EstadoAsignacion } from '../../../assignments/domain/entities/asignacion.entity.js';
import { AsignacionesRepositorio } from '../../../assignments/domain/repositories/asignaciones.repository.js';
import { EmergenciasRepositorio } from '../../../emergencies/domain/repositories/emergencias.repository.js';
import {
  type MotivoRuta,
  RutaAsignacion,
} from '../../domain/entities/ruta_asignacion.entity.js';
import { RutasAsignacionRepositorio } from '../../domain/repositories/rutas_asignacion.repository.js';
import {
  ProveedoresRutas,
  type RutaCalculada,
} from '../../domain/services/proveedor_rutas.js';

/** Mientras la ambulancia va hacia la emergencia. En escena ya no hay ruta que mostrar. */
export const ESTADOS_CON_RUTA: readonly EstadoAsignacion[] = [
  'asignada',
  'en_camino',
];

/**
 * Una posición más vieja que esto no sirve como punto de partida: la
 * ambulancia pudo moverse (o el dato ser de otra ciudad). Se espera al
 * siguiente reporte GPS en vez de trazar una ruta equivocada.
 */
export const ANTIGUEDAD_MAXIMA_ORIGEN_MS = 10 * 60 * 1000;

export interface CalcularRutaEntrada {
  asignacionId: string;
  motivo: MotivoRuta;
  /** Posición recién reportada; si no viene, la última conocida de la ambulancia. */
  origen?: PuntoGeografico;
}

/**
 * Calcula la ruta por calles de un servicio, la guarda y avisa por el bus de
 * eventos. Devuelve null (y no guarda nada) cuando no se puede calcular: sin
 * GPS reciente, emergencia sin coordenadas o proveedores sin respuesta. Nunca
 * lanza: lo invocan eventos, no una petición HTTP.
 */
@Injectable()
export class CalcularRutaAsignacion {
  private readonly logger = new Logger(CalcularRutaAsignacion.name);
  private readonly enCurso = new ConsultasEnCurso<RutaAsignacion | null>();

  constructor(
    private readonly rutasRepositorio: RutasAsignacionRepositorio,
    private readonly asignacionesRepositorio: AsignacionesRepositorio,
    private readonly emergenciasRepositorio: EmergenciasRepositorio,
    private readonly ambulanciasRepositorio: AmbulanciasRepositorio,
    private readonly proveedores: ProveedoresRutas,
    private readonly eventos: PublicadorEventos,
  ) {}

  /** Dos disparos simultáneos para el mismo servicio (despacho + primer GPS) calculan una sola vez. */
  ejecutar(datos: CalcularRutaEntrada): Promise<RutaAsignacion | null> {
    return this.enCurso.ejecutar(datos.asignacionId, () =>
      this.calcular(datos),
    );
  }

  private async calcular({
    asignacionId,
    motivo,
    origen,
  }: CalcularRutaEntrada): Promise<RutaAsignacion | null> {
    const asignacion =
      await this.asignacionesRepositorio.buscarPorId(asignacionId);
    if (!asignacion || !ESTADOS_CON_RUTA.includes(asignacion.estado))
      return null;

    const emergencia = await this.emergenciasRepositorio.buscarPorId(
      asignacion.emergenciaId,
    );
    const destino = emergencia?.coordenadas;
    if (!destino) return null;

    const ahora = new Date();
    const partida =
      origen ??
      (await this.ultimaPosicionReciente(asignacion.ambulanciaId, ahora));
    if (!partida) return null;

    const calculada = await this.consultarProveedores(partida, destino);
    if (!calculada) return null;

    const ruta = await this.rutasRepositorio.guardar(
      RutaAsignacion.calcular({
        asignacionId,
        tramo: 'hacia_emergencia',
        motivo,
        origen: partida,
        destino,
        ruta: calculada.ruta,
        proveedor: calculada.proveedor,
        calculadaEn: ahora,
      }),
    );
    this.eventos.publicar({
      tipo: 'asignacion.ruta_actualizada',
      asignacionId,
    });
    return ruta;
  }

  private async ultimaPosicionReciente(
    ambulanciaId: string,
    ahora: Date,
  ): Promise<PuntoGeografico | null> {
    const ambulancia =
      await this.ambulanciasRepositorio.buscarPorId(ambulanciaId);
    const ubicacion = ambulancia?.ultimaUbicacion;
    if (
      !ubicacion ||
      ahora.getTime() - ubicacion.registradaEn.getTime() >
        ANTIGUEDAD_MAXIMA_ORIGEN_MS
    ) {
      return null;
    }
    return { latitud: ubicacion.latitud, longitud: ubicacion.longitud };
  }

  /** Proveedores en orden; una falla técnica pasa al siguiente. */
  private async consultarProveedores(
    origen: PuntoGeografico,
    destino: PuntoGeografico,
  ): Promise<{ proveedor: string; ruta: RutaCalculada } | null> {
    for (const proveedor of this.proveedores.enOrden()) {
      if (!proveedor.estaConfigurado()) continue;
      try {
        const ruta = await proveedor.calcular(origen, destino);
        if (ruta && ruta.geometria.length >= 2) {
          return { proveedor: proveedor.nombre, ruta };
        }
      } catch (error) {
        if (!(error instanceof FallaProveedorExterno)) throw error;
        // Sin coordenadas en el log: solo proveedor y motivo.
        this.logger.warn(
          `Proveedor de rutas ${error.proveedor} falló (${error.motivo}): ${error.message}`,
        );
      }
    }
    return null;
  }
}
