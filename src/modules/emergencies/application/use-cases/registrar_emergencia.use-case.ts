import { Injectable } from '@nestjs/common';
import { PublicadorEventos } from '../../../../common/events/publicador_eventos.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import {
  Emergencia,
  type DatosNuevaEmergencia,
} from '../../domain/entities/emergencia.entity.js';
import {
  EmergenciasRepositorio,
  NumeroEmergenciaEnUsoError,
} from '../../domain/repositories/emergencias.repository.js';

export type RegistrarEmergenciaEntrada = Omit<
  DatosNuevaEmergencia,
  'numeroEmergencia' | 'recibidaPorId' | 'recibidaEn'
>;

/** Si dos despachadores registran a la vez y chocan en el consecutivo, se reintenta. */
const INTENTOS_NUMERO = 3;

@Injectable()
export class RegistrarEmergencia {
  constructor(
    private readonly emergenciasRepositorio: EmergenciasRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
    private readonly eventos: PublicadorEventos,
  ) {}

  async ejecutar(
    datos: RegistrarEmergenciaEntrada,
    contexto: ContextoSolicitud,
  ): Promise<Emergencia> {
    const recibidaEn = new Date();
    const prefijo = Emergencia.prefijoNumero(recibidaEn);

    for (let intento = 1; ; intento++) {
      const consecutivo =
        (await this.emergenciasRepositorio.ultimoConsecutivo(prefijo)) + 1;
      const nueva = Emergencia.crear({
        ...datos,
        numeroEmergencia: Emergencia.formatearNumero(recibidaEn, consecutivo),
        recibidaPorId: contexto.usuarioId,
        recibidaEn,
      });

      try {
        const emergencia = await this.emergenciasRepositorio.crear(nueva);
        await this.auditoria.registrar({
          usuarioId: contexto.usuarioId,
          entidad: 'emergencias',
          entidadId: emergencia.id,
          accion: 'crear',
          detalle: {
            numeroEmergencia: emergencia.numeroEmergencia,
            tipoIncidente: emergencia.tipoIncidente,
            prioridad: emergencia.prioridad,
          },
          direccionIp: contexto.direccionIp,
        });
        this.eventos.publicar({
          tipo: 'emergencia.creada',
          emergenciaId: emergencia.id,
        });
        return emergencia;
      } catch (error) {
        if (
          error instanceof NumeroEmergenciaEnUsoError &&
          intento < INTENTOS_NUMERO
        ) {
          continue;
        }
        throw error;
      }
    }
  }
}
