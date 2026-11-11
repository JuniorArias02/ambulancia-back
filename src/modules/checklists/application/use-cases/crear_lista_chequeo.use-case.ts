import { Injectable } from '@nestjs/common';
import { NoAutenticadoError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import {
  type DatosNuevoEstado,
  type DatosNuevoItem,
  ListaChequeo,
} from '../../domain/entities/lista_chequeo.entity.js';
import { ListasChequeoRepositorio } from '../../domain/repositories/listas_chequeo.repository.js';

export interface CrearListaChequeoEntrada {
  nombre: string;
  descripcion?: string | null;
  items: DatosNuevoItem[];
  estados: DatosNuevoEstado[];
}

@Injectable()
export class CrearListaChequeo {
  constructor(
    private readonly listasRepositorio: ListasChequeoRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    datos: CrearListaChequeoEntrada,
    contexto: ContextoSolicitud,
  ): Promise<ListaChequeo> {
    if (!contexto.usuarioId) throw new NoAutenticadoError();
    const lista = await this.listasRepositorio.crear(
      ListaChequeo.crear({
        ...datos,
        creadaPorId: contexto.usuarioId,
        fecha: new Date(),
      }),
    );

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'listas_chequeo',
      entidadId: lista.id,
      accion: 'crear',
      detalle: {
        nombre: lista.nombre,
        totalPreguntas: lista.items.length,
        totalOpciones: lista.estados.length,
      },
      direccionIp: contexto.direccionIp,
    });
    return lista;
  }
}
