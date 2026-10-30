import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { EventoDominio } from '../../../../common/events/eventos_dominio.js';
import { PublicadorEventos } from '../../../../common/events/publicador_eventos.js';
import { ConfiguracionRutas } from '../../application/configuracion_rutas.js';
import { CalcularRutaAsignacion } from '../../application/use-cases/calcular_ruta_asignacion.use-case.js';
import { RutasAsignacionRepositorio } from '../../domain/repositories/rutas_asignacion.repository.js';

type EventoUbicacion = Extract<
  EventoDominio,
  { tipo: 'ambulancia.ubicacion_actualizada' }
>;

/**
 * Decide cuándo vale la pena calcular una ruta: al despachar y cuando la
 * ambulancia se sale de la vigente. No recalcula en cada reporte GPS (cada
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
    } else if (evento.tipo === 'ambulancia.ubicacion_actualizada') {
      await this.alMoverse(evento);
    }
  }

  private async alMoverse(evento: EventoUbicacion): Promise<void> {
    if (!evento.asignacionId) return;
    const posicion = { latitud: evento.latitud, longitud: evento.longitud };
    const vigente = await this.rutasRepositorio.buscarVigente(
      evento.asignacionId,
    );

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
