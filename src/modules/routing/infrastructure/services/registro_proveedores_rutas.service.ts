import { Logger } from '@nestjs/common';
import {
  type ProveedorRutas,
  ProveedoresRutas,
} from '../../domain/services/proveedor_rutas.js';

/**
 * Único lugar donde se decide qué proveedores de rutas se usan y en qué orden
 * (variable RUTAS_PROVEEDORES). Para sumar uno: implementar `ProveedorRutas`,
 * pasarlo en `disponibles` desde el módulo y nombrarlo en la variable.
 */
export class RegistroProveedoresRutas extends ProveedoresRutas {
  private readonly logger = new Logger(RegistroProveedoresRutas.name);
  private readonly ordenados: readonly ProveedorRutas[];

  constructor(
    disponibles: readonly ProveedorRutas[],
    orden: readonly string[],
  ) {
    super();
    const porNombre = new Map(disponibles.map((p) => [p.nombre, p]));
    this.ordenados = orden.flatMap((nombre) => {
      const proveedor = porNombre.get(nombre);
      if (!proveedor) {
        this.logger.warn(`Proveedor de rutas desconocido: ${nombre}`);
        return [];
      }
      return [proveedor];
    });
  }

  enOrden(): readonly ProveedorRutas[] {
    return this.ordenados;
  }
}
