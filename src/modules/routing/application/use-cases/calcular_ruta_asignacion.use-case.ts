import { Injectable, Logger } from '@nestjs/common';
import { PublicadorEventos } from '../../../../common/events/publicador_eventos.js';
import { FallaProveedorExterno } from '../../../../common/exceptions/falla_proveedor_externo.js';
import { ConsultasEnCurso } from '../../../../common/utils/consultas_en_curso.js';
import type { PuntoGeografico } from '../../../../common/utils/geografia.js';
import { AmbulanciasRepositorio } from '../../../ambulances/domain/repositories/ambulancias.repository.js';
import type { Asignacion } from '../../../assignments/domain/entities/asignacion.entity.js';
import { AsignacionesRepositorio } from '../../../assignments/domain/repositories/asignaciones.repository.js';
import { EmergenciasRepositorio } from '../../../emergencies/domain/repositories/emergencias.repository.js';
import {
  type MotivoRuta,
  RutaAsignacion,
  type TramoRuta,
  tramoDelEstado,
} from '../../domain/entities/ruta_asignacion.entity.js';
import { RutasAsignacionRepositorio } from '../../domain/repositories/rutas_asignacion.repository.js';
import {
  ProveedoresRutas,
  type RutaCalculada,
} from '../../domain/services/proveedor_rutas.js';

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
 * Calcula la ruta por calles de un servicio, hacia la emergencia o hacia el
 * hospital según su estado, la guarda y avisa por el bus de eventos. Devuelve
 * null (y no guarda nada) cuando no se puede calcular: sin GPS reciente, destino
 * sin definir o sin coordenadas, o proveedores sin respuesta. Nunca lanza: lo
 * invocan eventos, no una petición HTTP.
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

  /**
   * Dos disparos simultáneos hacia el mismo destino (despacho + primer GPS)
   * calculan una sola vez; si el hospital cambió, no se reutiliza el cálculo anterior.
   */
  async ejecutar(datos: CalcularRutaEntrada): Promise<RutaAsignacion | null> {
    // Antes de leer: si el destino cambia después, esta ruta queda invalidada.
    const calculadaEn = new Date();
    const asignacion = await this.asignacionesRepositorio.buscarPorId(
      datos.asignacionId,
    );
    const tramo = asignacion ? tramoDelEstado(asignacion.estado) : null;
    if (!asignacion || !tramo) return null;
    const destino = await this.destinoDe(asignacion, tramo);
    if (!destino) return null;

    return this.enCurso.ejecutar(
      `${asignacion.id}:${tramo}:${destino.latitud},${destino.longitud}`,
      () => this.calcular(datos, asignacion, tramo, destino, calculadaEn),
    );
  }

  private async calcular(
    { asignacionId, motivo, origen }: CalcularRutaEntrada,
    asignacion: Asignacion,
    tramo: TramoRuta,
    destino: PuntoGeografico,
    calculadaEn: Date,
  ): Promise<RutaAsignacion | null> {
    const partida =
      origen ??
      (await this.ultimaPosicionReciente(asignacion.ambulanciaId, calculadaEn));
    if (!partida) return null;

    const calculada = await this.consultarProveedores(partida, destino);
    if (!calculada) return null;

    const nueva = RutaAsignacion.calcular({
      asignacionId,
      tramo,
      motivo,
      origen: partida,
      destino,
      ruta: calculada.ruta,
      proveedor: calculada.proveedor,
      calculadaEn,
    });
    // El proveedor tarda: el servicio pudo avanzar o cambiar de hospital.
    const actual = await this.asignacionesRepositorio.buscarPorId(asignacionId);
    if (!actual || !nueva.esVigentePara(actual)) return null;

    const ruta = await this.rutasRepositorio.guardar(nueva);
    this.eventos.publicar({
      tipo: 'asignacion.ruta_actualizada',
      asignacionId,
    });
    return ruta;
  }

  private async destinoDe(
    asignacion: Asignacion,
    tramo: TramoRuta,
  ): Promise<PuntoGeografico | null> {
    if (tramo === 'hacia_destino') {
      return asignacion.destino?.coordenadas ?? null;
    }
    const emergencia = await this.emergenciasRepositorio.buscarPorId(
      asignacion.emergenciaId,
    );
    return emergencia?.coordenadas ?? null;
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
