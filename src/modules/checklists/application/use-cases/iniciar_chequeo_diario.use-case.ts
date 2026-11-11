import { Injectable } from '@nestjs/common';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import { ChequeoDiario } from '../../domain/entities/chequeo_diario.entity.js';
import { ChequeosDiariosRepositorio } from '../../domain/repositories/chequeos_diarios.repository.js';
import {
  type ChequeoDelDia,
  ObtenerMiChequeoDelDia,
} from './obtener_mi_chequeo_del_dia.use-case.js';

export interface ChequeoIniciado extends ChequeoDelDia {
  chequeo: ChequeoDiario;
  /** `false` si ya existía: iniciar dos veces no crea otro. */
  creado: boolean;
}

@Injectable()
export class IniciarChequeoDiario {
  constructor(
    private readonly obtenerDelDia: ObtenerMiChequeoDelDia,
    private readonly chequeosRepositorio: ChequeosDiariosRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    contexto: ContextoSolicitud,
    ahora: Date = new Date(),
  ): Promise<ChequeoIniciado> {
    const delDia = await this.obtenerDelDia.ejecutar(contexto, ahora);
    if (delDia.chequeo) {
      return { ...delDia, chequeo: delDia.chequeo, creado: false };
    }

    const { chequeo, creado } = await this.chequeosRepositorio.crear(
      ChequeoDiario.iniciar({
        listaChequeoId: delDia.lista.id,
        conductorId: delDia.conductorId,
        ambulanciaId: delDia.ambulanciaId,
        ahora,
      }),
    );
    if (creado) {
      await this.auditoria.registrar({
        usuarioId: contexto.usuarioId,
        entidad: 'chequeos_diarios',
        entidadId: chequeo.id,
        accion: 'iniciar',
        detalle: { ambulanciaId: chequeo.ambulanciaId, fecha: chequeo.fecha },
        direccionIp: contexto.direccionIp,
      });
    }
    return { ...delDia, chequeo, creado };
  }
}
