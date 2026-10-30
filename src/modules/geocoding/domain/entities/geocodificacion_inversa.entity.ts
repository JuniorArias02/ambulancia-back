import type { PuntoGeografico } from '../../../../common/utils/geografia.js';
import type { PrecisionUbicacion } from '../services/precision_ubicacion.js';
import type {
  ComponentesDireccion,
  LugarEncontrado,
} from '../services/proveedor_geocodificacion.js';
import {
  DIAS_PARA_REINTENTAR_NO_ENCONTRADA,
  type EstadoGeocodificacion,
} from './direccion_geocodificada.entity.js';

/** ~1 m: dos clics en el mismo sitio comparten resultado sin mezclar casas vecinas. */
const DECIMALES_CLAVE = 5;

const SIN_COMPONENTES: ComponentesDireccion = {
  calle: null,
  numero: null,
  barrio: null,
  ciudad: null,
  departamento: null,
  codigoPostal: null,
  pais: null,
};

export interface PropiedadesGeocodificacionInversa {
  id: string;
  clavePunto: string;
  puntoSolicitado: PuntoGeografico;
  direccion: string | null;
  lineaDireccion: string | null;
  componentes: ComponentesDireccion;
  coordenadasDireccion: PuntoGeografico | null;
  distanciaMetros: number | null;
  precision: PrecisionUbicacion | null;
  proveedor: string;
  proveedorResultadoId: string | null;
  estado: EstadoGeocodificacion;
  creadaEn: Date;
  actualizadaEn: Date;
}

interface DatosConsulta {
  clavePunto: string;
  puntoSolicitado: PuntoGeografico;
  proveedor: string;
  fecha: Date;
}

/** La dirección que corresponde a un punto del mapa. */
export class GeocodificacionInversa {
  private constructor(
    private readonly propiedades: PropiedadesGeocodificacionInversa,
  ) {}

  static clavePunto({ latitud, longitud }: PuntoGeografico): string {
    return `${latitud.toFixed(DECIMALES_CLAVE)}|${longitud.toFixed(DECIMALES_CLAVE)}`;
  }

  static encontrada(
    datos: DatosConsulta & {
      lugar: LugarEncontrado;
      precision: PrecisionUbicacion;
    },
  ): GeocodificacionInversa {
    const { lugar, precision } = datos;
    const base = {
      id: crypto.randomUUID(),
      clavePunto: datos.clavePunto,
      puntoSolicitado: datos.puntoSolicitado,
      distanciaMetros: Math.round(lugar.distanciaMetros * 10) / 10,
      precision,
      proveedor: datos.proveedor,
      estado: 'encontrada' as const,
      creadaEn: datos.fecha,
      actualizadaEn: datos.fecha,
    };

    if (precision !== 'zona') {
      return new GeocodificacionInversa({
        ...base,
        direccion: lugar.direccionFormateada,
        lineaDireccion: lugar.lineaDireccion,
        componentes: { ...lugar.componentes },
        coordenadasDireccion: lugar.coordenadas,
        proveedorResultadoId: lugar.proveedorResultadoId,
      });
    }

    // En `zona` el lugar más cercano está lejos (una escuela a 900 m, por
    // ejemplo): su nombre, calle y placa no describen el punto. Solo se
    // conserva lo que sí lo describe: barrio, municipio y departamento.
    const { barrio, ciudad, departamento, pais } = lugar.componentes;
    return new GeocodificacionInversa({
      ...base,
      direccion: [barrio, ciudad, departamento].filter(Boolean).join(', '),
      lineaDireccion: null,
      componentes: { ...SIN_COMPONENTES, barrio, ciudad, departamento, pais },
      coordenadasDireccion: null,
      proveedorResultadoId: null,
    });
  }

  static noEncontrada(datos: DatosConsulta): GeocodificacionInversa {
    return new GeocodificacionInversa({
      id: crypto.randomUUID(),
      clavePunto: datos.clavePunto,
      puntoSolicitado: datos.puntoSolicitado,
      direccion: null,
      lineaDireccion: null,
      componentes: { ...SIN_COMPONENTES },
      coordenadasDireccion: null,
      distanciaMetros: null,
      precision: null,
      proveedor: datos.proveedor,
      proveedorResultadoId: null,
      estado: 'no_encontrada',
      creadaEn: datos.fecha,
      actualizadaEn: datos.fecha,
    });
  }

  static reconstruir(
    propiedades: PropiedadesGeocodificacionInversa,
  ): GeocodificacionInversa {
    return new GeocodificacionInversa({ ...propiedades });
  }

  get id(): string {
    return this.propiedades.id;
  }
  get clavePunto(): string {
    return this.propiedades.clavePunto;
  }
  get puntoSolicitado(): PuntoGeografico {
    return this.propiedades.puntoSolicitado;
  }
  get direccion(): string | null {
    return this.propiedades.direccion;
  }
  get lineaDireccion(): string | null {
    return this.propiedades.lineaDireccion;
  }
  get componentes(): ComponentesDireccion {
    return this.propiedades.componentes;
  }
  get coordenadasDireccion(): PuntoGeografico | null {
    return this.propiedades.coordenadasDireccion;
  }
  get distanciaMetros(): number | null {
    return this.propiedades.distanciaMetros;
  }
  get precision(): PrecisionUbicacion | null {
    return this.propiedades.precision;
  }
  get proveedor(): string {
    return this.propiedades.proveedor;
  }
  get proveedorResultadoId(): string | null {
    return this.propiedades.proveedorResultadoId;
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

  /** Mismo criterio que las direcciones: las no encontradas se reintentan pasados unos días. */
  esReutilizable(ahora: Date): boolean {
    if (this.fueEncontrada()) return true;
    const limite =
      this.propiedades.actualizadaEn.getTime() +
      DIAS_PARA_REINTENTAR_NO_ENCONTRADA * 24 * 60 * 60 * 1000;
    return ahora.getTime() < limite;
  }
}
