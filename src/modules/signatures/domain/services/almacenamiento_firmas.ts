/**
 * Dónde quedan las imágenes de las firmas. La implementación las cifra: el
 * dominio solo entrega y recibe el contenido original.
 */
export abstract class AlmacenamientoFirmas {
  abstract guardar(clave: string, contenido: Uint8Array): Promise<void>;
  /** `null` si el archivo ya no existe. */
  abstract leer(clave: string): Promise<Uint8Array | null>;
  abstract eliminar(clave: string): Promise<void>;
}
