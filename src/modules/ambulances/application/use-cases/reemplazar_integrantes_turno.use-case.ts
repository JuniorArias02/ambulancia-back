import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import { PublicadorEventos } from '../../../../common/events/publicador_eventos.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type {
  NuevoIntegrante,
  Turno,
} from '../../domain/entities/turno.entity.js';
import { TurnosRepositorio } from '../../domain/repositories/turnos.repository.js';
import { ValidadorTripulacion } from '../services/validador_tripulacion.service.js';

@Injectable()
export class ReemplazarIntegrantesTurno {
  constructor(
    private readonly turnosRepositorio: TurnosRepositorio,
    private readonly validadorTripulacion: ValidadorTripulacion,
    private readonly auditoria: AuditoriaRepositorio,
    private readonly eventos: PublicadorEventos,
  ) {}

  async ejecutar(
    turnoId: string,
    integrantes: NuevoIntegrante[],
    contexto: ContextoSolicitud,
  ): Promise<Turno> {
    const turno = await this.turnosRepositorio.buscarPorId(turnoId);
    if (!turno) throw new RecursoNoEncontradoError('Turno');

    const anteriores = turno.integrantes.map((i) => ({
      usuarioId: i.usuarioId,
      funcion: i.funcion,
    }));
    turno.reemplazarIntegrantes(integrantes);
    await this.validadorTripulacion.validar(integrantes, turno.id);

    const actualizado =
      await this.turnosRepositorio.reemplazarIntegrantes(turno);

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'turnos',
      entidadId: turno.id,
      accion: 'reemplazar_integrantes',
      detalle: { anteriores, nuevos: integrantes.map((i) => ({ ...i })) },
      direccionIp: contexto.direccionIp,
    });
    this.eventos.publicar({
      tipo: 'turno.actualizado',
      turnoId: turno.id,
      usuariosAfectados: [
        ...new Set([
          ...anteriores.map((i) => i.usuarioId),
          ...integrantes.map((i) => i.usuarioId),
        ]),
      ],
    });

    return actualizado;
  }
}
