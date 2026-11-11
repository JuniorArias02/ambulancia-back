import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import { ChequeosDiariosRepositorio } from '../../domain/repositories/chequeos_diarios.repository.js';
import { ListasChequeoRepositorio } from '../../domain/repositories/listas_chequeo.repository.js';
import { ObtenerMiChequeoDelDia } from './obtener_mi_chequeo_del_dia.use-case.js';
import type { ChequeoConLista } from './responder_chequeo_diario.use-case.js';

@Injectable()
export class FinalizarChequeoDiario {
  constructor(
    private readonly obtenerDelDia: ObtenerMiChequeoDelDia,
    private readonly listasRepositorio: ListasChequeoRepositorio,
    private readonly chequeosRepositorio: ChequeosDiariosRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    contexto: ContextoSolicitud,
    ahora: Date = new Date(),
  ): Promise<ChequeoConLista> {
    const { chequeo } = await this.obtenerDelDia.ejecutar(contexto, ahora);
    if (!chequeo) {
      throw new RecursoNoEncontradoError('Chequeo de hoy (inícielo primero)');
    }
    const lista = await this.listasRepositorio.buscarPorId(
      chequeo.listaChequeoId,
    );
    if (!lista) throw new RecursoNoEncontradoError('Lista de chequeo');

    chequeo.finalizar(lista, ahora);
    const finalizado = await this.chequeosRepositorio.finalizar(chequeo);

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'chequeos_diarios',
      entidadId: chequeo.id,
      accion: 'finalizar',
      detalle: {
        ambulanciaId: chequeo.ambulanciaId,
        fecha: chequeo.fecha,
        totalRespuestas: chequeo.respuestas.length,
        conObservacion: chequeo.respuestas.filter((r) => r.tieneObservacion)
          .length,
      },
      direccionIp: contexto.direccionIp,
    });
    return { chequeo: finalizado, lista };
  }
}
