import { Injectable } from '@nestjs/common';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type { ListaChequeo } from '../../domain/entities/lista_chequeo.entity.js';
import { ListasChequeoRepositorio } from '../../domain/repositories/listas_chequeo.repository.js';
import { ConsultarListasChequeo } from './consultar_listas_chequeo.use-case.js';

export interface ActualizarListaChequeoEntrada {
  nombre?: string;
  descripcion?: string | null;
}

/** Nombre y descripción. Activar y desactivar tienen su propio caso de uso. */
@Injectable()
export class ActualizarListaChequeo {
  constructor(
    private readonly consultarListas: ConsultarListasChequeo,
    private readonly listasRepositorio: ListasChequeoRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    id: string,
    datos: ActualizarListaChequeoEntrada,
    contexto: ContextoSolicitud,
  ): Promise<ListaChequeo> {
    const lista = await this.consultarListas.obtener(id);
    lista.actualizarDatos(datos, new Date());
    const actualizada = await this.listasRepositorio.actualizar(lista);

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'listas_chequeo',
      entidadId: lista.id,
      accion: 'actualizar',
      detalle: {
        campos: Object.entries(datos)
          .filter(([, valor]) => valor !== undefined)
          .map(([campo]) => campo),
      },
      direccionIp: contexto.direccionIp,
    });
    return actualizada;
  }
}
