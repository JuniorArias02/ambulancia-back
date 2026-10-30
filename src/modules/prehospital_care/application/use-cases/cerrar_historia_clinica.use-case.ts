import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import {
  type DetalleHistoria,
  HistoriasClinicasRepositorio,
} from '../../domain/repositories/historias_clinicas.repository.js';
import { AccesoHistoriaClinica } from '../services/acceso_historia_clinica.service.js';
import { HuellaHistoria } from '../services/huella_historia.service.js';

/** Valida que esté completa, la sella con la huella y desde ahí ya no se edita. */
@Injectable()
export class CerrarHistoriaClinica {
  constructor(
    private readonly historiasRepositorio: HistoriasClinicasRepositorio,
    private readonly acceso: AccesoHistoriaClinica,
    private readonly huella: HuellaHistoria,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    historiaId: string,
    contexto: ContextoSolicitud,
  ): Promise<DetalleHistoria> {
    await this.acceso.cargarParaEditar(historiaId, contexto);
    const detalle = await this.historiasRepositorio.buscarDetalle(historiaId);
    if (!detalle) throw new RecursoNoEncontradoError('Historia clínica');

    const { historia } = detalle;
    historia.cerrar({
      cerradaPorId: contexto.usuarioId ?? '',
      fecha: new Date(),
      hash: this.huella.calcular(detalle),
      registros: { signosVitales: detalle.signosVitales.length },
    });
    const cerrada = await this.historiasRepositorio.actualizar(
      historia,
      'borrador',
    );

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'historias_clinicas',
      entidadId: historia.id,
      accion: 'cerrar',
      detalle: {
        numeroHistoria: historia.numeroHistoria,
        hashCierre: cerrada.hashCierre,
      },
      direccionIp: contexto.direccionIp,
    });
    return { ...detalle, historia: cerrada };
  }
}
