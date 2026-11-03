import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface.js';
import type { ArchivosPorLado } from '../../application/services/documentos_cargados.service.js';
import { TAMANO_MAXIMO_DOCUMENTO_BYTES } from '../../domain/services/archivo_documento.js';

/** Lo que entrega multer en memoria; solo los campos que se usan. */
export interface ArchivoRecibido {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

export interface ArchivosFormulario {
  documentoFrontal?: ArchivoRecibido[];
  documentoPosterior?: ArchivoRecibido[];
}

export const CAMPOS_ARCHIVOS = [
  { name: 'documentoFrontal', maxCount: 1 },
  { name: 'documentoPosterior', maxCount: 1 },
];

/** Un archivo más grande corta la subida con 413 antes de llegar al caso de uso. */
export const LIMITES_SUBIDA: MulterOptions = {
  limits: {
    fileSize: TAMANO_MAXIMO_DOCUMENTO_BYTES,
    files: CAMPOS_ARCHIVOS.length,
    fields: 20,
    fieldSize: 2048,
  },
};

function aCargado(archivo: ArchivoRecibido | undefined) {
  return archivo
    ? {
        nombreOriginal: archivo.originalname,
        tipoMimeDeclarado: archivo.mimetype,
        contenido: new Uint8Array(archivo.buffer),
      }
    : undefined;
}

export function archivosPorLado(
  archivos: ArchivosFormulario | undefined,
): ArchivosPorLado {
  const frontal = aCargado(archivos?.documentoFrontal?.[0]);
  const posterior = aCargado(archivos?.documentoPosterior?.[0]);
  return {
    ...(frontal && { frontal }),
    ...(posterior && { posterior }),
  };
}

export function exigirAmbasFotos(archivos: ArchivosPorLado) {
  const { frontal, posterior } = archivos;
  if (!frontal || !posterior) {
    throw new BadRequestException(
      'Adjunte las dos fotos del documento: documentoFrontal y documentoPosterior',
    );
  }
  return { frontal, posterior };
}
