import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import { LectorImagenFirma } from '../../../signatures/application/services/lector_imagen_firma.service.js';
import { FirmasUsuariosRepositorio } from '../../../signatures/domain/repositories/firmas_usuarios.repository.js';
import {
  AccesoHistoriaClinica,
  type Solicitante,
} from '../services/acceso_historia_clinica.service.js';

/**
 * La imagen de la firma estampada en una historia cerrada: siempre la versión
 * que se usó al firmar, aunque el profesional la haya cambiado después.
 * Para la tripulación clínica y el administrador; queda auditada.
 */
@Injectable()
export class ObtenerFirmaCierre {
  constructor(
    private readonly acceso: AccesoHistoriaClinica,
    private readonly firmasRepositorio: FirmasUsuariosRepositorio,
    private readonly lector: LectorImagenFirma,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    historiaId: string,
    solicitante: Solicitante,
    contexto: ContextoSolicitud,
  ): Promise<Uint8Array> {
    const historia = await this.acceso.buscarHistoria(historiaId);
    await this.acceso.exigirLectura(historia, solicitante);
    const firma = historia.firmaCierre
      ? await this.firmasRepositorio.buscarPorId(historia.firmaCierre.id)
      : null;
    if (!firma) {
      throw new RecursoNoEncontradoError('Firma de cierre de la historia');
    }
    const contenido = await this.lector.leer(firma);
    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'historias_clinicas',
      entidadId: historiaId,
      accion: 'consultar_firma_cierre',
      detalle: { firmaId: firma.id },
      direccionIp: contexto.direccionIp,
    });
    return contenido;
  }
}
