import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  type DocumentoIdentidad,
  LADOS_DOCUMENTO,
  type LadoDocumento,
} from '../../domain/entities/verificacion_identidad.entity.js';
import { AlmacenamientoDocumentos } from '../../domain/services/almacenamiento_documentos.js';
import {
  type ArchivoCargado,
  validarArchivoDocumento,
} from '../../domain/services/archivo_documento.js';

export type ArchivosPorLado = Partial<Record<LadoDocumento, ArchivoCargado>>;

const NOMBRES_CAMPO: Record<LadoDocumento, string> = {
  frontal: 'Foto frontal del documento',
  posterior: 'Foto posterior del documento',
};

/**
 * Valida y guarda en el almacenamiento privado las fotos de un envío. El
 * registro y el reenvío la usan igual; si la base de datos falla después,
 * `descartar` borra lo guardado para no dejar archivos huérfanos.
 */
@Injectable()
export class DocumentosCargados {
  private readonly logger = new Logger(DocumentosCargados.name);

  constructor(private readonly almacenamiento: AlmacenamientoDocumentos) {}

  /** Valida todos antes de guardar el primero: un archivo inválido no deja nada a medias. */
  async guardar(
    archivos: ArchivosPorLado,
    fecha: Date,
  ): Promise<DocumentoIdentidad[]> {
    const validos = LADOS_DOCUMENTO.flatMap((lado) => {
      const archivo = archivos[lado];
      return archivo
        ? [
            {
              lado,
              archivo: validarArchivoDocumento(archivo, NOMBRES_CAMPO[lado]),
            },
          ]
        : [];
    });

    const guardados: DocumentoIdentidad[] = [];
    try {
      for (const { lado, archivo } of validos) {
        const clave = crypto.randomUUID();
        await this.almacenamiento.guardar(clave, archivo.contenido);
        guardados.push({
          id: crypto.randomUUID(),
          lado,
          claveAlmacenamiento: clave,
          tipoMime: archivo.tipoMime,
          tamanoBytes: archivo.contenido.byteLength,
          huellaSha256: createHash('sha256')
            .update(archivo.contenido)
            .digest('hex'),
          cargadoEn: fecha,
        });
      }
      return guardados;
    } catch (error) {
      await this.descartar(guardados);
      throw error;
    }
  }

  async descartar(documentos: readonly DocumentoIdentidad[]): Promise<void> {
    for (const documento of documentos) {
      try {
        await this.almacenamiento.eliminar(documento.claveAlmacenamiento);
      } catch {
        // Solo la clave interna: nunca datos del ciudadano en el log.
        this.logger.error(
          `No se pudo borrar el archivo huérfano ${documento.claveAlmacenamiento}`,
        );
      }
    }
  }
}
