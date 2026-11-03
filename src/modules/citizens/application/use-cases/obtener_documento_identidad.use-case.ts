import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type { DocumentoIdentidad } from '../../domain/entities/verificacion_identidad.entity.js';
import { CiudadanosRepositorio } from '../../domain/repositories/ciudadanos.repository.js';
import { AlmacenamientoDocumentos } from '../../domain/services/almacenamiento_documentos.js';

export interface ArchivoDocumentoIdentidad {
  documento: DocumentoIdentidad;
  contenido: Uint8Array;
}

/** La foto solo sale por aquí, para el administrador y con auditoría. */
@Injectable()
export class ObtenerDocumentoIdentidad {
  constructor(
    private readonly ciudadanosRepositorio: CiudadanosRepositorio,
    private readonly almacenamiento: AlmacenamientoDocumentos,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    usuarioId: string,
    documentoId: string,
    contexto: ContextoSolicitud,
  ): Promise<ArchivoDocumentoIdentidad> {
    // El documento tiene que ser de ese ciudadano: conocer un id no basta.
    const documento = await this.ciudadanosRepositorio.buscarDocumento(
      usuarioId,
      documentoId,
    );
    const contenido = documento
      ? await this.almacenamiento.leer(documento.claveAlmacenamiento)
      : null;
    if (!documento || !contenido) {
      throw new RecursoNoEncontradoError('Documento de identidad');
    }

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'documentos_identidad',
      entidadId: documento.id,
      accion: 'consultar',
      detalle: { ciudadanoId: usuarioId, lado: documento.lado },
      direccionIp: contexto.direccionIp,
    });
    return { documento, contenido };
  }
}
