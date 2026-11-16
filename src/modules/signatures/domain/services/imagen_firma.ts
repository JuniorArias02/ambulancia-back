import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';

/** Lo que la tabla admite (CHECK `firmas_usuarios_tamano_check`). */
export const TAMANO_MAXIMO_FIRMA_BYTES = 200 * 1024;

export const DIMENSIONES_FIRMA = {
  anchoMinimo: 150,
  altoMinimo: 50,
  anchoMaximo: 2000,
  altoMaximo: 1000,
} as const;

export interface ImagenFirmaValida {
  tamanoBytes: number;
  anchoPx: number;
  altoPx: number;
}

const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** Fragmento final de todo PNG completo: longitud 0, "IEND" y su CRC fijo. */
const FIN_PNG = [
  0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
];

/**
 * Revisa el contenido real del archivo, no el nombre ni el tipo que declara
 * el cliente: debe ser un PNG completo, con dimensiones de firma.
 */
export function validarImagenFirma(contenido: Uint8Array): ImagenFirmaValida {
  if (contenido.byteLength === 0) {
    throw new ReglaNegocioError('Adjunte la imagen de la firma');
  }
  if (contenido.byteLength > TAMANO_MAXIMO_FIRMA_BYTES) {
    throw new ReglaNegocioError('La imagen de la firma supera 200 KB');
  }
  const esPng =
    contenido.byteLength >= 33 &&
    FIRMA_PNG.every((byte, i) => contenido[i] === byte) &&
    textoEn(contenido, 12, 4) === 'IHDR' &&
    FIN_PNG.every(
      (byte, i) =>
        contenido[contenido.byteLength - FIN_PNG.length + i] === byte,
    );
  if (!esPng) {
    throw new ReglaNegocioError('La firma debe ser una imagen PNG completa');
  }
  const vista = new DataView(
    contenido.buffer,
    contenido.byteOffset,
    contenido.byteLength,
  );
  const anchoPx = vista.getUint32(16);
  const altoPx = vista.getUint32(20);
  const d = DIMENSIONES_FIRMA;
  if (
    anchoPx < d.anchoMinimo ||
    altoPx < d.altoMinimo ||
    anchoPx > d.anchoMaximo ||
    altoPx > d.altoMaximo
  ) {
    throw new ReglaNegocioError(
      `La firma debe medir entre ${d.anchoMinimo}x${d.altoMinimo} y ${d.anchoMaximo}x${d.altoMaximo} píxeles`,
    );
  }
  return { tamanoBytes: contenido.byteLength, anchoPx, altoPx };
}

function textoEn(contenido: Uint8Array, desde: number, largo: number): string {
  return String.fromCharCode(...contenido.subarray(desde, desde + largo));
}
