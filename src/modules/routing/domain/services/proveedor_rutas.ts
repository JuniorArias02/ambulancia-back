import type { PuntoGeografico } from '../../../../common/utils/geografia.js';

/** Ruta por calles entre dos puntos, sin importar el proveedor. */
export interface RutaCalculada {
  /** Puntos en orden, desde el origen hasta el destino. */
  geometria: PuntoGeografico[];
  distanciaMetros: number;
  /** Sin tráfico en tiempo real: depende de lo que estime el proveedor. */
  duracionSegundos: number;
}

export abstract class ProveedorRutas {
  /** Se guarda en `rutas_asignacion.proveedor`. */
  abstract readonly nombre: string;
  abstract estaConfigurado(): boolean;
  /**
   * `null` si no hay forma de llegar por calles (por ejemplo, el destino está
   * en el mar). Lanza `FallaProveedorExterno` ante errores técnicos.
   */
  abstract calcular(
    origen: PuntoGeografico,
    destino: PuntoGeografico,
  ): Promise<RutaCalculada | null>;
}

/** Proveedores en el orden en que se intentan (el siguiente es el respaldo). */
export abstract class ProveedoresRutas {
  abstract enOrden(): readonly ProveedorRutas[];
}
