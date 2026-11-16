import { Injectable } from '@nestjs/common';
import {
  NoAutenticadoError,
  RecursoNoEncontradoError,
} from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type { FirmaUsuario } from '../../domain/entities/firma_usuario.entity.js';
import { FirmasUsuariosRepositorio } from '../../domain/repositories/firmas_usuarios.repository.js';
import { LectorImagenFirma } from '../services/lector_imagen_firma.service.js';

export interface ImagenFirma {
  firma: FirmaUsuario;
  contenido: Uint8Array;
}

/** La imagen solo sale descifrada por aquí, y cada consulta queda auditada. */
@Injectable()
export class ObtenerImagenFirma {
  constructor(
    private readonly firmasRepositorio: FirmasUsuariosRepositorio,
    private readonly lector: LectorImagenFirma,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  /** La firma vigente de quien consulta. */
  async propia(contexto: ContextoSolicitud): Promise<ImagenFirma> {
    if (!contexto.usuarioId) throw new NoAutenticadoError();
    const firma = await this.firmasRepositorio.buscarVigente(
      contexto.usuarioId,
    );
    if (!firma) throw new RecursoNoEncontradoError('Firma registrada');
    return this.entregar(firma, contexto);
  }

  /** Cualquier versión de la firma de un usuario (solo el administrador). */
  async deUsuario(
    usuarioId: string,
    firmaId: string,
    contexto: ContextoSolicitud,
  ): Promise<ImagenFirma> {
    const firma = await this.firmasRepositorio.buscarPorId(firmaId);
    // Debe ser de ese usuario: conocer un id no basta.
    if (!firma || firma.usuarioId !== usuarioId) {
      throw new RecursoNoEncontradoError('Firma');
    }
    return this.entregar(firma, contexto);
  }

  private async entregar(
    firma: FirmaUsuario,
    contexto: ContextoSolicitud,
  ): Promise<ImagenFirma> {
    const contenido = await this.lector.leer(firma);
    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'firmas_usuarios',
      entidadId: firma.id,
      accion: 'consultar_imagen',
      detalle: { usuarioFirmanteId: firma.usuarioId },
      direccionIp: contexto.direccionIp,
    });
    return { firma, contenido };
  }
}
