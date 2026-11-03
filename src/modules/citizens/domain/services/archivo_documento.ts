import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';

export const TAMANO_MAXIMO_DOCUMENTO_BYTES = 5 * 1024 * 1024;
/** Una foto legible de un documento no pesa menos que esto. */
export const TAMANO_MINIMO_DOCUMENTO_BYTES = 5 * 1024;

interface FormatoPermitido {
  extensiones: readonly string[];
  /** Firma de los primeros bytes: el tipo real, no el que declara el cliente. */
  firma: readonly number[];
}

export const FORMATOS_DOCUMENTO = {
  'image/jpeg': { extensiones: ['jpg', 'jpeg'], firma: [0xff, 0xd8, 0xff] },
  'image/png': {
    extensiones: ['png'],
    firma: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
} as const satisfies Record<string, FormatoPermitido>;
export type TipoMimeDocumento = keyof typeof FORMATOS_DOCUMENTO;
export const TIPOS_MIME_DOCUMENTO: readonly TipoMimeDocumento[] = [
  'image/jpeg',
  'image/png',
];

export interface ArchivoCargado {
  nombreOriginal: string;
  tipoMimeDeclarado: string;
  contenido: Uint8Array;
}

export interface ArchivoDocumentoValido {
  tipoMime: TipoMimeDocumento;
  contenido: Uint8Array;
}

function esTipoPermitido(tipo: string): tipo is TipoMimeDocumento {
  return TIPOS_MIME_DOCUMENTO.some((permitido) => permitido === tipo);
}

/**
 * Coinciden el tipo declarado, la extensión y los bytes reales. El nombre
 * original solo sirve para esta comprobación: nunca decide dónde se guarda.
 */
export function validarArchivoDocumento(
  archivo: ArchivoCargado,
  nombreCampo: string,
): ArchivoDocumentoValido {
  const tamano = archivo.contenido.byteLength;
  if (tamano > TAMANO_MAXIMO_DOCUMENTO_BYTES) {
    throw new ReglaNegocioError(
      `${nombreCampo}: supera el máximo de ${TAMANO_MAXIMO_DOCUMENTO_BYTES / (1024 * 1024)} MB`,
    );
  }
  if (tamano < TAMANO_MINIMO_DOCUMENTO_BYTES) {
    throw new ReglaNegocioError(
      `${nombreCampo}: la imagen es demasiado pequeña para leer el documento`,
    );
  }

  const tipo = archivo.tipoMimeDeclarado.toLowerCase();
  const extension =
    archivo.nombreOriginal.split('.').pop()?.toLowerCase() ?? '';
  if (!esTipoPermitido(tipo)) {
    throw new ReglaNegocioError(
      `${nombreCampo}: solo se aceptan fotos JPG o PNG`,
    );
  }
  const formato = FORMATOS_DOCUMENTO[tipo];
  const extensionValida = formato.extensiones.some((e) => e === extension);
  const firmaValida = formato.firma.every(
    (byte, indice) => archivo.contenido[indice] === byte,
  );
  if (!extensionValida || !firmaValida) {
    throw new ReglaNegocioError(
      `${nombreCampo}: el archivo no es una foto ${tipo === 'image/png' ? 'PNG' : 'JPG'} válida`,
    );
  }
  return { tipoMime: tipo, contenido: archivo.contenido };
}
