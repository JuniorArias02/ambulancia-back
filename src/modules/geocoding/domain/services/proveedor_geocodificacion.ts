import type { PuntoGeografico } from '../../../../common/utils/geografia.js';

/** Lo que se le pide a cualquier proveedor (Geoapify, Google, Nominatim…). */
export interface ConsultaGeocodificacion {
  direccion: string;
  ciudad: string | null;
}

export interface UbicacionEncontrada {
  latitud: number;
  longitud: number;
  direccionFormateada: string | null;
  proveedorResultadoId: string | null;
  /** 0 a 1, en la escala del proveedor; null si no la informa. */
  confianza: number | null;
}

/**
 * Candidatos del mejor al peor, ya filtrados por la confiabilidad propia del
 * proveedor (tipo de resultado, nivel de confianza, país). Lista vacía = el
 * proveedor no encontró nada confiable, que es una respuesta válida.
 */
export interface ResultadoProveedor {
  candidatos: UbicacionEncontrada[];
}

export interface ComponentesDireccion {
  calle: string | null;
  /** Placa en la nomenclatura colombiana: "19 61" en "Cl 100 19 61". */
  numero: string | null;
  barrio: string | null;
  ciudad: string | null;
  departamento: string | null;
  codigoPostal: string | null;
  /** Código ISO de 2 letras, en minúsculas. */
  pais: string | null;
}

/** Lo más cercano que el proveedor conoce a un punto del mapa. */
export interface LugarEncontrado {
  direccionFormateada: string | null;
  /** Primera línea de la dirección: "Cl 100 19 61". */
  lineaDireccion: string | null;
  componentes: ComponentesDireccion;
  /** Dónde está el lugar encontrado, que puede no coincidir con el punto pedido. */
  coordenadas: PuntoGeografico;
  /** Distancia entre el punto pedido y el lugar encontrado. */
  distanciaMetros: number;
  proveedorResultadoId: string | null;
}

/** `lugar: null` = el proveedor no conoce nada en ese punto (o está fuera del país). */
export interface ResultadoInversoProveedor {
  lugar: LugarEncontrado | null;
}

/** Falla técnica de un proveedor: no se guarda y se prueba el siguiente. */
export {
  FallaProveedorExterno as FallaProveedorGeocodificacion,
  MOTIVOS_FALLA_PROVEEDOR,
  type MotivoFallaProveedor,
} from '../../../../common/exceptions/falla_proveedor_externo.js';

export abstract class ProveedorGeocodificacion {
  /** Se guarda en la columna `proveedor` de las tablas de geocodificación. */
  abstract readonly nombre: string;
  /** false si falta la clave o está incompleta: el proveedor se omite. */
  abstract estaConfigurado(): boolean;
  /** Lanza `FallaProveedorGeocodificacion` ante errores técnicos. */
  abstract geocodificar(
    consulta: ConsultaGeocodificacion,
  ): Promise<ResultadoProveedor>;
  /** Dirección de un punto del mapa. Lanza `FallaProveedorGeocodificacion` ante errores técnicos. */
  abstract geocodificarInverso(
    punto: PuntoGeografico,
  ): Promise<ResultadoInversoProveedor>;
}

/** Proveedores en el orden en que se intentan (el siguiente es el respaldo). */
export abstract class ProveedoresGeocodificacion {
  abstract enOrden(): readonly ProveedorGeocodificacion[];
}
