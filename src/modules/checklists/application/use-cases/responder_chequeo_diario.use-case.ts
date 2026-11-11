import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import type {
  ChequeoDiario,
  DatosRespuesta,
} from '../../domain/entities/chequeo_diario.entity.js';
import type { ListaChequeo } from '../../domain/entities/lista_chequeo.entity.js';
import { ChequeosDiariosRepositorio } from '../../domain/repositories/chequeos_diarios.repository.js';
import { ListasChequeoRepositorio } from '../../domain/repositories/listas_chequeo.repository.js';
import { ObtenerMiChequeoDelDia } from './obtener_mi_chequeo_del_dia.use-case.js';

export interface ChequeoConLista {
  chequeo: ChequeoDiario;
  lista: ListaChequeo;
}

/** Guarda una o varias respuestas del borrador; responder otra vez una pregunta la reemplaza. */
@Injectable()
export class ResponderChequeoDiario {
  constructor(
    private readonly obtenerDelDia: ObtenerMiChequeoDelDia,
    private readonly listasRepositorio: ListasChequeoRepositorio,
    private readonly chequeosRepositorio: ChequeosDiariosRepositorio,
  ) {}

  async ejecutar(
    respuestas: DatosRespuesta[],
    contexto: ContextoSolicitud,
    ahora: Date = new Date(),
  ): Promise<ChequeoConLista> {
    const { chequeo } = await this.obtenerDelDia.ejecutar(contexto, ahora);
    if (!chequeo) {
      throw new RecursoNoEncontradoError('Chequeo de hoy (inícielo primero)');
    }
    // La lista del chequeo, no la activa: el administrador pudo cambiarla hoy.
    const lista = await this.listasRepositorio.buscarPorId(
      chequeo.listaChequeoId,
    );
    if (!lista) throw new RecursoNoEncontradoError('Lista de chequeo');

    for (const respuesta of respuestas) {
      chequeo.responder(lista, respuesta, ahora);
    }
    return {
      chequeo: await this.chequeosRepositorio.guardarRespuestas(chequeo),
      lista,
    };
  }
}
