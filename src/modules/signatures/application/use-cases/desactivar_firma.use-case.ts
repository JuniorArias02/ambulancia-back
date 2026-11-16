import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type { FirmaUsuario } from '../../domain/entities/firma_usuario.entity.js';
import { FirmasUsuariosRepositorio } from '../../domain/repositories/firmas_usuarios.repository.js';

/**
 * El administrador desactiva la firma vigente de un usuario. Las historias
 * ya firmadas con ella no cambian; para volver a firmar, el usuario debe
 * registrar una nueva.
 */
@Injectable()
export class DesactivarFirma {
  constructor(
    private readonly firmasRepositorio: FirmasUsuariosRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    usuarioId: string,
    firmaId: string,
    motivo: string,
    contexto: ContextoSolicitud,
  ): Promise<FirmaUsuario> {
    const firma = await this.firmasRepositorio.buscarPorId(firmaId);
    if (!firma || firma.usuarioId !== usuarioId) {
      throw new RecursoNoEncontradoError('Firma');
    }
    firma.desactivar({
      porId: contexto.usuarioId ?? '',
      motivo,
      fecha: new Date(),
    });
    const desactivada = await this.firmasRepositorio.desactivar(firma);
    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'firmas_usuarios',
      entidadId: firma.id,
      accion: 'desactivar',
      detalle: {
        usuarioFirmanteId: usuarioId,
        motivo: desactivada.motivoDesactivacion ?? '',
      },
      direccionIp: contexto.direccionIp,
    });
    return desactivada;
  }
}
