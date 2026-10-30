import type { PuntoGeografico } from '../../../../common/utils/geografia.js';
import { distanciaPuntoARuta } from '../services/geometria_ruta.js';
import type { RutaCalculada } from '../services/proveedor_rutas.js';

/** Por ahora solo hasta la emergencia; el tramo al hospital llegará con el destino del traslado. */
export const TRAMOS_RUTA = ['hacia_emergencia'] as const;
export type TramoRuta = (typeof TRAMOS_RUTA)[number];

/**
 * - `despacho`: al asignar la ambulancia.
 * - `sin_ruta`: no se pudo calcular al despachar (sin GPS reciente) y llegó la primera posición.
 * - `desvio`: la ambulancia se alejó de la ruta vigente.
 */
export const MOTIVOS_RUTA = ['despacho', 'sin_ruta', 'desvio'] as const;
export type MotivoRuta = (typeof MOTIVOS_RUTA)[number];

export interface PropiedadesRutaAsignacion {
  id: string;
  asignacionId: string;
  tramo: TramoRuta;
  motivo: MotivoRuta;
  origen: PuntoGeografico;
  destino: PuntoGeografico;
  geometria: PuntoGeografico[];
  distanciaMetros: number;
  duracionSegundos: number;
  proveedor: string;
  calculadaEn: Date;
}

export class RutaAsignacion {
  private constructor(
    private readonly propiedades: PropiedadesRutaAsignacion,
  ) {}

  static calcular(datos: {
    asignacionId: string;
    tramo: TramoRuta;
    motivo: MotivoRuta;
    origen: PuntoGeografico;
    destino: PuntoGeografico;
    ruta: RutaCalculada;
    proveedor: string;
    calculadaEn: Date;
  }): RutaAsignacion {
    return new RutaAsignacion({
      id: crypto.randomUUID(),
      asignacionId: datos.asignacionId,
      tramo: datos.tramo,
      motivo: datos.motivo,
      origen: datos.origen,
      destino: datos.destino,
      geometria: datos.ruta.geometria,
      distanciaMetros: Math.round(datos.ruta.distanciaMetros),
      duracionSegundos: Math.round(datos.ruta.duracionSegundos),
      proveedor: datos.proveedor,
      calculadaEn: datos.calculadaEn,
    });
  }

  static reconstruir(propiedades: PropiedadesRutaAsignacion): RutaAsignacion {
    return new RutaAsignacion({ ...propiedades });
  }

  get id(): string {
    return this.propiedades.id;
  }
  get asignacionId(): string {
    return this.propiedades.asignacionId;
  }
  get tramo(): TramoRuta {
    return this.propiedades.tramo;
  }
  get motivo(): MotivoRuta {
    return this.propiedades.motivo;
  }
  get origen(): PuntoGeografico {
    return this.propiedades.origen;
  }
  get destino(): PuntoGeografico {
    return this.propiedades.destino;
  }
  get geometria(): readonly PuntoGeografico[] {
    return this.propiedades.geometria;
  }
  get distanciaMetros(): number {
    return this.propiedades.distanciaMetros;
  }
  get duracionSegundos(): number {
    return this.propiedades.duracionSegundos;
  }
  get proveedor(): string {
    return this.propiedades.proveedor;
  }
  get calculadaEn(): Date {
    return this.propiedades.calculadaEn;
  }

  /** Hora estimada de llegada según el cálculo (no se actualiza con el avance). */
  llegadaEstimada(): Date {
    return new Date(
      this.propiedades.calculadaEn.getTime() +
        this.propiedades.duracionSegundos * 1000,
    );
  }

  estaDesviada(punto: PuntoGeografico, toleranciaMetros: number): boolean {
    return (
      distanciaPuntoARuta(punto, this.propiedades.geometria) > toleranciaMetros
    );
  }

  /** Evita recalcular (y pagar) en cada reporte GPS mientras la ambulancia sigue fuera de la ruta. */
  admiteRecalculo(ahora: Date, intervaloMinimoMs: number): boolean {
    return (
      ahora.getTime() - this.propiedades.calculadaEn.getTime() >=
      intervaloMinimoMs
    );
  }
}
