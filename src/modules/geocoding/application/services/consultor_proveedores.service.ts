import { Injectable, Logger } from '@nestjs/common';
import { ServicioNoDisponibleError } from '../../../../common/exceptions/errores_dominio.js';
import {
  FallaProveedorGeocodificacion,
  type ProveedorGeocodificacion,
  ProveedoresGeocodificacion,
} from '../../domain/services/proveedor_geocodificacion.js';

export interface RespuestaProveedores<T> {
  /** Quién dio el valor o, si ninguno lo encontró, el último que respondió. */
  proveedor: string;
  /** null = los proveedores respondieron, pero ninguno encontró algo útil. */
  valor: T | null;
}

/**
 * Recorre los proveedores configurados en orden y aplica el respaldo: una
 * falla técnica pasa al siguiente; no encontrar nada útil también, porque
 * otro proveedor puede tener mejores datos. Si todos fallan, la operación
 * no puede responder (503) y no se debe guardar nada.
 */
@Injectable()
export class ConsultorProveedores {
  private readonly logger = new Logger(ConsultorProveedores.name);

  constructor(private readonly proveedores: ProveedoresGeocodificacion) {}

  async consultar<T>(
    operacion: (proveedor: ProveedorGeocodificacion) => Promise<T | null>,
  ): Promise<RespuestaProveedores<T>> {
    const configurados = this.proveedores
      .enOrden()
      .filter((proveedor) => proveedor.estaConfigurado());
    if (configurados.length === 0) {
      throw new ServicioNoDisponibleError(
        'La geocodificación no está configurada (falta GEOAPIFY_API_KEY)',
      );
    }

    let ultimoQueRespondio: string | null = null;
    for (const proveedor of configurados) {
      try {
        const valor = await operacion(proveedor);
        ultimoQueRespondio = proveedor.nombre;
        if (valor !== null) return { proveedor: proveedor.nombre, valor };
      } catch (error) {
        if (!(error instanceof FallaProveedorGeocodificacion)) throw error;
        // Sin direcciones, coordenadas ni claves en el log: solo proveedor y motivo.
        this.logger.warn(
          `Proveedor ${error.proveedor} falló (${error.motivo}): ${error.message}`,
        );
      }
    }

    if (ultimoQueRespondio) {
      return { proveedor: ultimoQueRespondio, valor: null };
    }
    throw new ServicioNoDisponibleError(
      'El servicio de geocodificación no está disponible; intente de nuevo o marque el punto en el mapa',
    );
  }
}
