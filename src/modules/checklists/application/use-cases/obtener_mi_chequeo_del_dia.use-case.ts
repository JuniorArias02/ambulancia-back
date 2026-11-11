import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { ChequeoDiario } from '../../domain/entities/chequeo_diario.entity.js';
import type { ListaChequeo } from '../../domain/entities/lista_chequeo.entity.js';
import { ChequeosDiariosRepositorio } from '../../domain/repositories/chequeos_diarios.repository.js';
import { ListasChequeoRepositorio } from '../../domain/repositories/listas_chequeo.repository.js';
import { AmbulanciaDelConductor } from '../services/ambulancia_del_conductor.service.js';

export interface ChequeoDelDia {
  fecha: string;
  conductorId: string;
  ambulanciaId: string;
  lista: ListaChequeo;
  /** `null` si todavía no lo ha iniciado hoy. */
  chequeo: ChequeoDiario | null;
}

/** Lo que pinta la app: la lista activa y, si ya empezó, lo respondido hoy. */
@Injectable()
export class ObtenerMiChequeoDelDia {
  constructor(
    private readonly ambulanciaDelConductor: AmbulanciaDelConductor,
    private readonly listasRepositorio: ListasChequeoRepositorio,
    private readonly chequeosRepositorio: ChequeosDiariosRepositorio,
  ) {}

  async ejecutar(
    contexto: ContextoSolicitud,
    ahora: Date = new Date(),
  ): Promise<ChequeoDelDia> {
    const { conductorId, ambulanciaId } =
      await this.ambulanciaDelConductor.obtener(contexto.usuarioId);
    const lista = await this.listasRepositorio.buscarActiva();
    if (!lista) {
      throw new RecursoNoEncontradoError('Lista de chequeo activa');
    }
    const fecha = ChequeoDiario.fechaDelDia(ahora);
    const chequeo = await this.chequeosRepositorio.buscarDelDia({
      listaChequeoId: lista.id,
      conductorId,
      ambulanciaId,
      fecha,
    });
    return { fecha, conductorId, ambulanciaId, lista, chequeo };
  }
}
