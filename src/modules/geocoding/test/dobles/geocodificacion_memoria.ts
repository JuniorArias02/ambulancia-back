import type { PuntoGeografico } from '../../../../common/utils/geografia.js';
import { ConsultorProveedores } from '../../application/services/consultor_proveedores.service.js';
import type { DireccionGeocodificada } from '../../domain/entities/direccion_geocodificada.entity.js';
import type { GeocodificacionInversa } from '../../domain/entities/geocodificacion_inversa.entity.js';
import { DireccionesGeocodificadasRepositorio } from '../../domain/repositories/direcciones_geocodificadas.repository.js';
import { GeocodificacionesInversasRepositorio } from '../../domain/repositories/geocodificaciones_inversas.repository.js';
import {
  type ConsultaGeocodificacion,
  ProveedorGeocodificacion,
  type LugarEncontrado,
  ProveedoresGeocodificacion,
  type ResultadoInversoProveedor,
  type ResultadoProveedor,
} from '../../domain/services/proveedor_geocodificacion.js';

export class DireccionesGeocodificadasMemoria extends DireccionesGeocodificadasRepositorio {
  readonly direcciones = new Map<string, DireccionGeocodificada>();

  buscarPorClave(clave: string): Promise<DireccionGeocodificada | null> {
    return Promise.resolve(this.direcciones.get(clave) ?? null);
  }

  guardar(direccion: DireccionGeocodificada): Promise<DireccionGeocodificada> {
    this.direcciones.set(direccion.direccionNormalizada, direccion);
    return Promise.resolve(direccion);
  }
}

/** Responde lo que se le programe y cuenta cuántas veces lo llamaron. */
export class GeocodificacionesInversasMemoria extends GeocodificacionesInversasRepositorio {
  readonly geocodificaciones = new Map<string, GeocodificacionInversa>();

  buscarPorClave(clave: string): Promise<GeocodificacionInversa | null> {
    return Promise.resolve(this.geocodificaciones.get(clave) ?? null);
  }

  guardar(
    geocodificacion: GeocodificacionInversa,
  ): Promise<GeocodificacionInversa> {
    this.geocodificaciones.set(geocodificacion.clavePunto, geocodificacion);
    return Promise.resolve(geocodificacion);
  }
}

export class ProveedorFalso extends ProveedorGeocodificacion {
  llamadas: ConsultaGeocodificacion[] = [];
  llamadasInversas: PuntoGeografico[] = [];
  respuestaInversa: () => Promise<ResultadoInversoProveedor> = () =>
    Promise.resolve({ lugar: null });
  respuesta: () => Promise<ResultadoProveedor> = () =>
    Promise.resolve({ candidatos: [] });

  constructor(
    readonly nombre: string,
    private readonly configurado = true,
  ) {
    super();
  }

  estaConfigurado(): boolean {
    return this.configurado;
  }

  geocodificar(consulta: ConsultaGeocodificacion): Promise<ResultadoProveedor> {
    this.llamadas.push(consulta);
    return this.respuesta();
  }

  geocodificarInverso(
    punto: PuntoGeografico,
  ): Promise<ResultadoInversoProveedor> {
    this.llamadasInversas.push(punto);
    return this.respuestaInversa();
  }
}

export class ProveedoresFijos extends ProveedoresGeocodificacion {
  constructor(private readonly lista: ProveedorGeocodificacion[]) {
    super();
  }

  enOrden(): readonly ProveedorGeocodificacion[] {
    return this.lista;
  }
}

export const UBICACION_PRUEBA = {
  latitud: 4.6573,
  longitud: -74.0601,
  direccionFormateada: 'Calle 72 15-20, Chapinero, Bogotá, Colombia',
  proveedorResultadoId: 'abc123',
  confianza: 0.95,
};

export function consultorCon(
  proveedores: ProveedorGeocodificacion[],
): ConsultorProveedores {
  return new ConsultorProveedores(new ProveedoresFijos(proveedores));
}

export const CONFIGURACION_PRUEBA = {
  pais: 'co',
  ciudadPredeterminada: 'Bogotá',
  distanciaMaximaInversaMetros: 100,
};

/** Lo que Geoapify devolvió al tocar la Calle 100 # 19-61 en la prueba real. */
export const LUGAR_PRUEBA: LugarEncontrado = {
  direccionFormateada: 'Cl 100 19 61, 111211 Bogotá, DC, Colombia',
  lineaDireccion: 'Cl 100 19 61',
  componentes: {
    calle: 'Cl 100',
    numero: '19 61',
    barrio: 'Chicó',
    ciudad: 'Bogotá',
    departamento: 'Distrito Especial',
    codigoPostal: '111211',
    pais: 'co',
  },
  coordenadas: { latitud: 4.685519, longitud: -74.052851 },
  distanciaMetros: 3,
  proveedorResultadoId: 'abc123',
};
