/**
 * Almacenamiento privado de las fotos de documentos. Las claves las genera
 * el backend; nunca salen del nombre que envió el cliente.
 */
export abstract class AlmacenamientoDocumentos {
  abstract guardar(clave: string, contenido: Uint8Array): Promise<void>;
  /** `null` si el archivo ya no existe. */
  abstract leer(clave: string): Promise<Uint8Array | null>;
  abstract eliminar(clave: string): Promise<void>;
}
