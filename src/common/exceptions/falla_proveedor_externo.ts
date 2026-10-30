export const MOTIVOS_FALLA_PROVEEDOR = [
  'credenciales_invalidas',
  'limite_excedido',
  'tiempo_agotado',
  'respuesta_invalida',
  'no_disponible',
] as const;
export type MotivoFallaProveedor = (typeof MOTIVOS_FALLA_PROVEEDOR)[number];

/**
 * Falla técnica de un servicio externo (geocodificación, rutas…). No dice
 * nada del dato pedido: no se guarda y, si hay respaldo, se prueba el
 * siguiente proveedor.
 */
export class FallaProveedorExterno extends Error {
  constructor(
    readonly proveedor: string,
    readonly motivo: MotivoFallaProveedor,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'FallaProveedorExterno';
  }
}
