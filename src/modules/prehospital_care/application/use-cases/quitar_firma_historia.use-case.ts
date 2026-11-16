import { Injectable, Logger } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import { AlmacenamientoFirmas } from '../../../signatures/domain/services/almacenamiento_firmas.js';
import { HistoriasClinicasRepositorio } from '../../domain/repositories/historias_clinicas.repository.js';
import { AccesoHistoriaClinica } from '../services/acceso_historia_clinica.service.js';

/**
 * Quita una firma mal tomada, solo con la historia en borrador. Como la
 * historia aún no está sellada, la imagen también se borra. Queda auditado.
 */
@Injectable()
export class QuitarFirmaHistoria {
  private readonly logger = new Logger(QuitarFirmaHistoria.name);

  constructor(
    private readonly historiasRepositorio: HistoriasClinicasRepositorio,
    private readonly acceso: AccesoHistoriaClinica,
    private readonly almacenamiento: AlmacenamientoFirmas,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    historiaId: string,
    firmaId: string,
    contexto: ContextoSolicitud,
  ): Promise<void> {
    await this.acceso.cargarParaEditar(historiaId, contexto);
    const firma = await this.historiasRepositorio.buscarFirmaHistoria(
      historiaId,
      firmaId,
    );
    if (
      !firma ||
      !(await this.historiasRepositorio.eliminarFirmaHistoria(
        historiaId,
        firmaId,
      ))
    ) {
      throw new RecursoNoEncontradoError('Firma');
    }
    if (firma.imagen) {
      try {
        await this.almacenamiento.eliminar(firma.imagen.claveAlmacenamiento);
      } catch {
        this.logger.error(
          `No se pudo borrar la imagen ${firma.imagen.claveAlmacenamiento}`,
        );
      }
    }
    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'historias_clinicas',
      entidadId: historiaId,
      accion: `eliminar_firma_${firma.rolFirmante}`,
      detalle: { registroId: firma.id, proposito: firma.proposito },
      direccionIp: contexto.direccionIp,
    });
  }
}
