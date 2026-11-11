import { Injectable } from '@nestjs/common';
import { ConflictoNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type {
  CambiosItem,
  DatosNuevoItem,
  ListaChequeo,
} from '../../domain/entities/lista_chequeo.entity.js';
import { ListasChequeoRepositorio } from '../../domain/repositories/listas_chequeo.repository.js';
import { ConsultarListasChequeo } from './consultar_listas_chequeo.use-case.js';

/** Agregar y editar preguntas de una lista. Nunca se borran: se desactivan. */
@Injectable()
export class GestionarPreguntasListaChequeo {
  constructor(
    private readonly consultarListas: ConsultarListasChequeo,
    private readonly listasRepositorio: ListasChequeoRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async agregar(
    listaId: string,
    datos: DatosNuevoItem,
    contexto: ContextoSolicitud,
  ): Promise<ListaChequeo> {
    const lista = await this.consultarListas.obtener(listaId);
    const item = lista.agregarItem(datos);
    const actualizada = await this.listasRepositorio.actualizar(lista);
    await this.auditar(lista.id, 'agregar_pregunta', item.id, contexto);
    return actualizada;
  }

  async actualizar(
    listaId: string,
    itemId: string,
    cambios: CambiosItem,
    contexto: ContextoSolicitud,
  ): Promise<ListaChequeo> {
    const lista = await this.consultarListas.obtener(listaId);
    // Cambiar el texto de una pregunta ya respondida cambiaría el historial.
    const actual = lista.buscarItem(itemId);
    if (
      actual &&
      cambios.pregunta !== undefined &&
      cambios.pregunta.trim() !== actual.pregunta &&
      (await this.listasRepositorio.itemTieneRespuestas(itemId))
    ) {
      throw new ConflictoNegocioError(
        'La pregunta ya tiene respuestas: desactívela y cree una nueva',
      );
    }
    lista.actualizarItem(itemId, cambios);
    const actualizada = await this.listasRepositorio.actualizar(lista);
    await this.auditar(lista.id, 'actualizar_pregunta', itemId, contexto);
    return actualizada;
  }

  private auditar(
    listaId: string,
    accion: string,
    itemId: string,
    contexto: ContextoSolicitud,
  ): Promise<void> {
    return this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'listas_chequeo',
      entidadId: listaId,
      accion,
      detalle: { itemId },
      direccionIp: contexto.direccionIp,
    });
  }
}
