import { StreamableFile } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface.js';
import { TAMANO_MAXIMO_FIRMA_BYTES } from '../../domain/services/imagen_firma.js';

/** Lo que entrega multer en memoria; solo lo que se usa. */
export interface ArchivoFirmaRecibido {
  buffer: Buffer;
}

/**
 * Límites de multer para un formulario con una firma: un archivo más grande
 * corta la subida con 413 antes de llegar al caso de uso. `campos` es cuántos
 * campos de texto admite el formulario.
 */
export function limitesSubidaFirma(campos: number): MulterOptions {
  return {
    limits: {
      fileSize: TAMANO_MAXIMO_FIRMA_BYTES,
      files: 1,
      fields: campos,
      fieldSize: 512,
    },
  };
}

/** La imagen descifrada, sin caché en el navegador ni en intermediarios. */
export function respuestaImagenFirma(contenido: Uint8Array): StreamableFile {
  return new StreamableFile(contenido, {
    type: 'image/png',
    disposition: 'inline; filename="firma.png"',
    length: contenido.byteLength,
  });
}
