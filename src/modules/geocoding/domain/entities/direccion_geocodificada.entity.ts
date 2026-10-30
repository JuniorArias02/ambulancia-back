import type { PuntoGeografico } from '../../../../common/utils/geografia.js';
import type { UbicacionEncontrada } from '../services/proveedor_geocodificacion.js';

export const ESTADOS_GEOCODIFICACION = ['encontrada', 'no_encontrada'] as const;
export type EstadoGeocodificacion = (typeof ESTADOS_GEOCODIFICACION)[number];

/**
 * Una dirección no encontrada se vuelve a intentar pasado este tiempo: el
 * proveedor actualiza su cartografía y la dirección pudo haberse agregado.
 */
export const DIAS_PARA_REINTENTAR_NO_ENCONTRADA = 7;

export interface PropiedadesDireccionGeocodificada {
  id: string;
  direccionOriginal: string;
  direccionNormalizada: string;
  ciudad: string | null;
  direccionFormateada: string | null;
  coordenadas: PuntoGeografico | null;
  proveedor: string;
  proveedorResultadoId: string | null;
  confianza: number | null;
  estado: EstadoGeocodificacion;
  creadaEn: Date;
  actualizadaEn: Date;
}

interface DatosConsulta {
  direccionOriginal: string;
  direccionNormalizada: string;
  ciudad: string | null;
  proveedor: string;
  fecha: Date;
}

export class DireccionGeocodificada {
  private constructor(
    private readonly propiedades: PropiedadesDireccionGeocodificada,
  ) {}

  static encontrada(
    datos: DatosConsulta & { ubicacion: UbicacionEncontrada },
  ): DireccionGeocodificada {
    return new DireccionGeocodificada({
      id: crypto.randomUUID(),
      direccionOriginal: datos.direccionOriginal,
      direccionNormalizada: datos.direccionNormalizada,
      ciudad: datos.ciudad,
      direccionFormateada: datos.ubicacion.direccionFormateada,
      coordenadas: {
        latitud: datos.ubicacion.latitud,
        longitud: datos.ubicacion.longitud,
      },
      proveedor: datos.proveedor,
      proveedorResultadoId: datos.ubicacion.proveedorResultadoId,
      confianza: datos.ubicacion.confianza,
      estado: 'encontrada',
      creadaEn: datos.fecha,
      actualizadaEn: datos.fecha,
    });
  }

  /** Se guarda sin coordenadas: nunca se inventa una ubicación. */
  static noEncontrada(datos: DatosConsulta): DireccionGeocodificada {
    return new DireccionGeocodificada({
      id: crypto.randomUUID(),
      direccionOriginal: datos.direccionOriginal,
      direccionNormalizada: datos.direccionNormalizada,
      ciudad: datos.ciudad,
      direccionFormateada: null,
      coordenadas: null,
      proveedor: datos.proveedor,
      proveedorResultadoId: null,
      confianza: null,
      estado: 'no_encontrada',
      creadaEn: datos.fecha,
      actualizadaEn: datos.fecha,
    });
  }

  static reconstruir(
    propiedades: PropiedadesDireccionGeocodificada,
  ): DireccionGeocodificada {
    return new DireccionGeocodificada({ ...propiedades });
  }

  static sonCoordenadasValidas(latitud: number, longitud: number): boolean {
    return (
      Number.isFinite(latitud) &&
      Number.isFinite(longitud) &&
      latitud >= -90 &&
      latitud <= 90 &&
      longitud >= -180 &&
      longitud <= 180 &&
      // (0, 0) es el valor por defecto de muchos servicios cuando fallan.
      !(latitud === 0 && longitud === 0)
    );
  }

  get id(): string {
    return this.propiedades.id;
  }
  get direccionOriginal(): string {
    return this.propiedades.direccionOriginal;
  }
  get direccionNormalizada(): string {
    return this.propiedades.direccionNormalizada;
  }
  get ciudad(): string | null {
    return this.propiedades.ciudad;
  }
  get direccionFormateada(): string | null {
    return this.propiedades.direccionFormateada;
  }
  get coordenadas(): PuntoGeografico | null {
    return this.propiedades.coordenadas;
  }
  get proveedor(): string {
    return this.propiedades.proveedor;
  }
  get proveedorResultadoId(): string | null {
    return this.propiedades.proveedorResultadoId;
  }
  get confianza(): number | null {
    return this.propiedades.confianza;
  }
  get estado(): EstadoGeocodificacion {
    return this.propiedades.estado;
  }
  get creadaEn(): Date {
    return this.propiedades.creadaEn;
  }
  get actualizadaEn(): Date {
    return this.propiedades.actualizadaEn;
  }

  fueEncontrada(): boolean {
    return this.propiedades.estado === 'encontrada';
  }

  /** ¿Se puede responder con este registro sin volver a consultar al proveedor? */
  esReutilizable(ahora: Date): boolean {
    if (this.fueEncontrada()) return true;
    const limite =
      this.propiedades.actualizadaEn.getTime() +
      DIAS_PARA_REINTENTAR_NO_ENCONTRADA * 24 * 60 * 60 * 1000;
    return ahora.getTime() < limite;
  }
}
