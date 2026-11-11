import { Injectable } from '@nestjs/common';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type {
  CambiosEstado,
  DatosNuevoEstado,
  ListaChequeo,
} from '../../domain/entities/lista_chequeo.entity.js';
import { ListasChequeoRepositorio } from '../../domain/repositories/listas_chequeo.repository.js';
import { ConsultarListasChequeo } from './consultar_listas_chequeo.use-case.js';

/** Opciones de calificación (Bien, Regular…). Nunca se borran: se desactivan. */
@Injectable()
export class GestionarOpcionesListaChequeo {
  constructor(
    private readonly consultarListas: ConsultarListasChequeo,
    private readonly listasRepositorio: ListasChequeoRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async agregar(
    listaId: string,
    datos: DatosNuevoEstado,
    contexto: ContextoSolicitud,
  ): Promise<ListaChequeo> {
    const lista = await this.consultarListas.obtener(listaId);
    const estado = lista.agregarEstado(datos);
    const actualizada = await this.listasRepositorio.actualizar(lista);
    await this.auditar(lista.id, 'agregar_opcion', estado.id, contexto);
    return actualizada;
  }

  async actualizar(
    listaId: string,
    estadoId: string,
    cambios: CambiosEstado,
    contexto: ContextoSolicitud,
  ): Promise<ListaChequeo> {
    const lista = await this.consultarListas.obtener(listaId);
    lista.actualizarEstado(estadoId, cambios);
    const actualizada = await this.listasRepositorio.actualizar(lista);
    await this.auditar(lista.id, 'actualizar_opcion', estadoId, contexto);
    return actualizada;
  }

  private auditar(
    listaId: string,
    accion: string,
    estadoId: string,
    contexto: ContextoSolicitud,
  ): Promise<void> {
    return this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'listas_chequeo',
      entidadId: listaId,
      accion,
      detalle: { estadoId },
      direccionIp: contexto.direccionIp,
    });
  }
}
