import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import { LectorImagenFirma } from '../../../signatures/application/services/lector_imagen_firma.service.js';
import { HistoriasClinicasRepositorio } from '../../domain/repositories/historias_clinicas.repository.js';
import {
  AccesoHistoriaClinica,
  type Solicitante,
} from '../services/acceso_historia_clinica.service.js';

/** La imagen de una firma de la historia (paciente, acudiente, testigo, receptor). Auditada. */
@Injectable()
export class ObtenerImagenFirmaHistoria {
  constructor(
    private readonly historiasRepositorio: HistoriasClinicasRepositorio,
    private readonly acceso: AccesoHistoriaClinica,
    private readonly lector: LectorImagenFirma,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    historiaId: string,
    firmaId: string,
    solicitante: Solicitante,
    contexto: ContextoSolicitud,
  ): Promise<Uint8Array> {
    const historia = await this.acceso.buscarHistoria(historiaId);
    await this.acceso.exigirLectura(historia, solicitante);
    const firma = await this.historiasRepositorio.buscarFirmaHistoria(
      historiaId,
      firmaId,
    );
    if (!firma?.imagen) {
      throw new RecursoNoEncontradoError('Imagen de la firma');
    }
    const contenido = await this.lector.leer(firma.imagen);
    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'historias_clinicas',
      entidadId: historiaId,
      accion: 'consultar_firma_historia',
      detalle: { firmaId: firma.id },
      direccionIp: contexto.direccionIp,
    });
    return contenido;
  }
}
