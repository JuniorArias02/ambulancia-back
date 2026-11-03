import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { EventoDominio } from '../../../../common/events/eventos_dominio.js';
import { PublicadorEventos } from '../../../../common/events/publicador_eventos.js';
import { AsignacionesRepositorio } from '../../../assignments/domain/repositories/asignaciones.repository.js';
import { ConfiguracionRutas } from '../../application/configuracion_rutas.js';
import { CalcularRutaAsignacion } from '../../application/use-cases/calcular_ruta_asignacion.use-case.js';
import { tramoDelEstado } from '../../domain/entities/ruta_asignacion.entity.js';
import { RutasAsignacionRepositorio } from '../../domain/repositories/rutas_asignacion.repository.js';

type EventoUbicacion = Extract<
  EventoDominio,
  { tipo: 'ambulancia.ubicacion_actualizada' }
>;

/**
 * Decide cuándo vale la pena calcular una ruta: al despachar, al iniciar el
 * traslado o cambiar de hospital, y cuando la ambulancia se sale de la vigente. No recalcula en cada reporte GPS (cada
 * cálculo consume cuota del proveedor). Escucha el bus de eventos: asignaciones
 * y ubicaciones no saben que este módulo existe.
 */
@Injectable()
export class RecalculadorRutas implements OnModuleInit {
  /**
   * Último intento por servicio cuando aún no hay ruta: si el cálculo falla
   * (proveedor sin cuota, emergencia sin coordenadas), no se reintenta en
   * cada reporte GPS.
   */
  private readonly intentosSinRuta = new Map<string, number>();

  constructor(
    private readonly eventos: PublicadorEventos,
    private readonly calcularRuta: CalcularRutaAsignacion,
    private readonly rutasRepositorio: RutasAsignacionRepositorio,
    private readonly asignacionesRepositorio: AsignacionesRepositorio,
    private readonly configuracion: ConfiguracionRutas,
  ) {}

  onModuleInit(): void {
    this.eventos.suscribir((evento) => this.alOcurrir(evento));
  }

  async alOcurrir(evento: EventoDominio): Promise<void> {
    if (evento.tipo === 'asignacion.creada') {
      await this.calcularRuta.ejecutar({
        asignacionId: evento.asignacionId,
        motivo: 'despacho',
      });
    } else if (evento.tipo === 'asignacion.actualizada') {
      await this.alCambiarServicio(evento.asignacionId);
    } else if (evento.tipo === 'ambulancia.ubicacion_actualizada') {
      await this.alMoverse(evento);
    }
  }

  /** Sin hospital elegido no hay nada que calcular; se hará cuando el conductor lo elija. */
  private async alCambiarServicio(asignacionId: string): Promise<void> {
    const asignacion =
      await this.asignacionesRepositorio.buscarPorId(asignacionId);
    if (asignacion?.estado !== 'trasladando' || !asignacion.destino) return;
    // Un hospital nuevo no debe esperar por los intentos fallidos del anterior.
    this.intentosSinRuta.delete(asignacionId);

    const ruta = await this.rutasRepositorio.buscarVigente(asignacionId);
    if (ruta?.esVigentePara(asignacion)) return;
    await this.calcularRuta.ejecutar({
      asignacionId,
      motivo: asignacion.destinoCambioEnTraslado()
        ? 'cambio_destino'
        : 'inicio_traslado',
    });
  }

  private async alMoverse(evento: EventoUbicacion): Promise<void> {
    if (!evento.asignacionId) return;
    const asignacion = await this.asignacionesRepositorio.buscarPorId(
      evento.asignacionId,
    );
    const tramo = asignacion ? tramoDelEstado(asignacion.estado) : null;
    if (!asignacion || !tramo) return;
    // Sin hospital no hay intento posible: no consume el límite de reintentos.
    if (tramo === 'hacia_destino' && !asignacion.destino) return;
    const posicion = { latitud: evento.latitud, longitud: evento.longitud };
    const ruta = await this.rutasRepositorio.buscarVigente(evento.asignacionId);
    const vigente = ruta?.esVigentePara(asignacion) ? ruta : null;

    if (!vigente) {
      if (!this.puedeReintentar(evento.asignacionId)) return;
      // Al despachar no había GPS reciente: esta es la primera posición útil.
      const ruta = await this.calcularRuta.ejecutar({
        asignacionId: evento.asignacionId,
        motivo: 'sin_ruta',
        origen: posicion,
      });
      if (ruta) this.intentosSinRuta.delete(evento.asignacionId);
      return;
    }

    if (
      vigente.estaDesviada(
        posicion,
        this.configuracion.distanciaDesvioMetros,
      ) &&
      vigente.admiteRecalculo(
        new Date(),
        this.configuracion.intervaloRecalculoMs,
      )
    ) {
      await this.calcularRuta.ejecutar({
        asignacionId: evento.asignacionId,
        motivo: 'desvio',
        origen: posicion,
      });
    }
  }

  private puedeReintentar(asignacionId: string): boolean {
    const ahora = Date.now();
    const ultimo = this.intentosSinRuta.get(asignacionId);
    if (
      ultimo !== undefined &&
      ahora - ultimo < this.configuracion.intervaloRecalculoMs
    ) {
      return false;
    }
    this.intentosSinRuta.set(asignacionId, ahora);
    return true;
  }
}
