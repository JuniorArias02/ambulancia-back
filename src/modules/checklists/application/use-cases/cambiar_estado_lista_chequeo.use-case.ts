import { Injectable } from '@nestjs/common';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type { ListaChequeo } from '../../domain/entities/lista_chequeo.entity.js';
import { ListasChequeoRepositorio } from '../../domain/repositories/listas_chequeo.repository.js';
import { ConsultarListasChequeo } from './consultar_listas_chequeo.use-case.js';

/** Solo una lista activa: activar esta desactiva las demás. */
@Injectable()
export class CambiarEstadoListaChequeo {
  constructor(
    private readonly consultarListas: ConsultarListasChequeo,
    private readonly listasRepositorio: ListasChequeoRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    id: string,
    activa: boolean,
    contexto: ContextoSolicitud,
  ): Promise<ListaChequeo> {
    const lista = await this.consultarListas.obtener(id);
    const ahora = new Date();
    let actualizada: ListaChequeo;
    if (activa) {
      lista.activar(ahora);
      actualizada = await this.listasRepositorio.activarUnica(lista);
    } else {
      lista.desactivar(ahora);
      actualizada = await this.listasRepositorio.actualizar(lista);
    }

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'listas_chequeo',
      entidadId: lista.id,
      accion: activa ? 'activar' : 'desactivar',
      direccionIp: contexto.direccionIp,
    });
    return actualizada;
  }
}
