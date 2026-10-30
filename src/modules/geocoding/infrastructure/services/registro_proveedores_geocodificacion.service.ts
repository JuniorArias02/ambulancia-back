import { Logger } from '@nestjs/common';
import {
  type ProveedorGeocodificacion,
  ProveedoresGeocodificacion,
} from '../../domain/services/proveedor_geocodificacion.js';

/**
 * Único lugar donde se decide qué proveedores se usan y en qué orden
 * (variable GEOCODIFICACION_PROVEEDORES). Para agregar uno nuevo: implementar
 * `ProveedorGeocodificacion`, pasarlo aquí en `disponibles` desde el módulo y
 * nombrarlo en la variable.
 */
export class RegistroProveedoresGeocodificacion extends ProveedoresGeocodificacion {
  private readonly logger = new Logger(RegistroProveedoresGeocodificacion.name);
  private readonly ordenados: readonly ProveedorGeocodificacion[];

  constructor(
    disponibles: readonly ProveedorGeocodificacion[],
    orden: readonly string[],
  ) {
    super();
    const porNombre = new Map(disponibles.map((p) => [p.nombre, p]));
    this.ordenados = orden.flatMap((nombre) => {
      const proveedor = porNombre.get(nombre);
      if (!proveedor) {
        this.logger.warn(`Proveedor de geocodificación desconocido: ${nombre}`);
        return [];
      }
      return [proveedor];
    });
  }

  enOrden(): readonly ProveedorGeocodificacion[] {
    return this.ordenados;
  }
}
