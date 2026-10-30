import { Injectable } from '@nestjs/common';
import {
  RecursoNoEncontradoError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type { DatosEditablesHistoria } from '../../domain/entities/historia_clinica.entity.js';
import {
  type DetalleHistoria,
  HistoriasClinicasRepositorio,
} from '../../domain/repositories/historias_clinicas.repository.js';
import { InstitucionesSaludRepositorio } from '../../domain/repositories/instituciones_salud.repository.js';
import { AccesoHistoriaClinica } from '../services/acceso_historia_clinica.service.js';

/** Guarda lo que se va llenando; se puede llamar muchas veces mientras es borrador. */
@Injectable()
export class ActualizarHistoriaClinica {
  constructor(
    private readonly historiasRepositorio: HistoriasClinicasRepositorio,
    private readonly institucionesRepositorio: InstitucionesSaludRepositorio,
    private readonly acceso: AccesoHistoriaClinica,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    historiaId: string,
    cambios: DatosEditablesHistoria,
    contexto: ContextoSolicitud,
  ): Promise<DetalleHistoria> {
    const historia = await this.acceso.cargarParaEditar(historiaId, contexto);

    if (cambios.institucionDestinoId) {
      const institucion = await this.institucionesRepositorio.buscarPorId(
        cambios.institucionDestinoId,
      );
      if (!institucion?.activa) {
        throw new ReglaNegocioError(
          'La institución de destino no existe o está inactiva',
        );
      }
    }

    historia.actualizar(cambios);
    await this.historiasRepositorio.actualizar(historia, 'borrador');

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'historias_clinicas',
      entidadId: historia.id,
      accion: 'actualizar',
      // Solo los nombres de los campos, nunca sus valores (datos de salud).
      detalle: {
        campos: Object.entries(cambios)
          .filter(([, valor]) => valor !== undefined)
          .map(([campo]) => campo),
      },
      direccionIp: contexto.direccionIp,
    });
    const detalle = await this.historiasRepositorio.buscarDetalle(historia.id);
    if (!detalle) throw new RecursoNoEncontradoError('Historia clínica');
    return detalle;
  }
}
