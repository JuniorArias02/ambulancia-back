import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import {
  crearIntervencion,
  crearLesion,
  crearSignoVital,
  type Intervencion,
  type Lesion,
  type MedicionesSignoVital,
  type SignoVital,
} from '../../domain/entities/registros_clinicos.js';
import type {
  RegionCorporal,
  TipoIntervencion,
  TipoLesion,
} from '../../domain/catalogos_clinicos.js';
import {
  HistoriasClinicasRepositorio,
  type TipoRegistroClinico,
} from '../../domain/repositories/historias_clinicas.repository.js';
import { AccesoHistoriaClinica } from '../services/acceso_historia_clinica.service.js';

/**
 * Agrega o quita signos vitales, lesiones e intervenciones de una historia en
 * borrador. Cada registro trae el id generado en el celular: reenviarlo no lo
 * duplica.
 */
@Injectable()
export class RegistrarEnHistoria {
  constructor(
    private readonly historiasRepositorio: HistoriasClinicasRepositorio,
    private readonly acceso: AccesoHistoriaClinica,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async signoVital(
    historiaId: string,
    datos: { id?: string; medidoEn?: Date; mediciones: MedicionesSignoVital },
    contexto: ContextoSolicitud,
  ): Promise<SignoVital> {
    await this.acceso.cargarParaEditar(historiaId, contexto);
    const signo = await this.historiasRepositorio.agregarSignoVital(
      crearSignoVital({
        id: datos.id ?? crypto.randomUUID(),
        historiaClinicaId: historiaId,
        medidoEn: datos.medidoEn ?? new Date(),
        mediciones: datos.mediciones,
        registradoPorId: contexto.usuarioId ?? '',
      }),
    );
    await this.auditar('registrar_signo_vital', historiaId, signo.id, contexto);
    return signo;
  }

  async lesion(
    historiaId: string,
    datos: {
      id?: string;
      regionCorporal: RegionCorporal;
      tipoLesion: TipoLesion;
      descripcion?: string;
    },
    contexto: ContextoSolicitud,
  ): Promise<Lesion> {
    await this.acceso.cargarParaEditar(historiaId, contexto);
    const lesion = await this.historiasRepositorio.agregarLesion(
      crearLesion({
        id: datos.id ?? crypto.randomUUID(),
        historiaClinicaId: historiaId,
        regionCorporal: datos.regionCorporal,
        tipoLesion: datos.tipoLesion,
        descripcion: datos.descripcion,
      }),
    );
    await this.auditar('registrar_lesion', historiaId, lesion.id, contexto);
    return lesion;
  }

  async intervencion(
    historiaId: string,
    datos: {
      id?: string;
      tipo: TipoIntervencion;
      nombre: string;
      dosis?: string;
      via?: string;
      realizadoEn?: Date;
      resultado?: string;
    },
    contexto: ContextoSolicitud,
  ): Promise<Intervencion> {
    await this.acceso.cargarParaEditar(historiaId, contexto);
    const intervencion = await this.historiasRepositorio.agregarIntervencion(
      crearIntervencion({
        id: datos.id ?? crypto.randomUUID(),
        historiaClinicaId: historiaId,
        tipo: datos.tipo,
        nombre: datos.nombre,
        dosis: datos.dosis,
        via: datos.via,
        realizadoEn: datos.realizadoEn ?? new Date(),
        resultado: datos.resultado,
        registradoPorId: contexto.usuarioId ?? '',
      }),
    );
    await this.auditar(
      'registrar_intervencion',
      historiaId,
      intervencion.id,
      contexto,
    );
    return intervencion;
  }

  /** Para corregir un error de digitación mientras la historia es borrador. Queda en la auditoría. */
  async eliminar(
    tipo: TipoRegistroClinico,
    historiaId: string,
    registroId: string,
    contexto: ContextoSolicitud,
  ): Promise<void> {
    await this.acceso.cargarParaEditar(historiaId, contexto);
    const eliminado = await this.historiasRepositorio.eliminarRegistro(
      tipo,
      historiaId,
      registroId,
    );
    if (!eliminado) throw new RecursoNoEncontradoError('Registro');
    await this.auditar(`eliminar_${tipo}`, historiaId, registroId, contexto);
  }

  private auditar(
    accion: string,
    historiaId: string,
    registroId: string,
    contexto: ContextoSolicitud,
  ): Promise<void> {
    return this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'historias_clinicas',
      entidadId: historiaId,
      accion,
      detalle: { registroId },
      direccionIp: contexto.direccionIp,
    });
  }
}
