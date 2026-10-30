import { Injectable } from '@nestjs/common';
import {
  ConflictoNegocioError,
  RecursoNoEncontradoError,
} from '../../../../common/exceptions/errores_dominio.js';
import { PublicadorEventos } from '../../../../common/events/publicador_eventos.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import {
  type NuevoIntegrante,
  Turno,
} from '../../domain/entities/turno.entity.js';
import { AmbulanciasRepositorio } from '../../domain/repositories/ambulancias.repository.js';
import { TurnosRepositorio } from '../../domain/repositories/turnos.repository.js';
import { ValidadorTripulacion } from '../services/validador_tripulacion.service.js';

export interface IniciarTurnoEntrada {
  ambulanciaId: string;
  integrantes: NuevoIntegrante[];
}

/** El turno no habilita la ambulancia: luego se pasa a disponible con su propio endpoint. */
@Injectable()
export class IniciarTurno {
  constructor(
    private readonly turnosRepositorio: TurnosRepositorio,
    private readonly ambulanciasRepositorio: AmbulanciasRepositorio,
    private readonly validadorTripulacion: ValidadorTripulacion,
    private readonly auditoria: AuditoriaRepositorio,
    private readonly eventos: PublicadorEventos,
  ) {}

  async ejecutar(
    datos: IniciarTurnoEntrada,
    contexto: ContextoSolicitud,
  ): Promise<Turno> {
    const ambulancia = await this.ambulanciasRepositorio.buscarPorId(
      datos.ambulanciaId,
    );
    if (!ambulancia) throw new RecursoNoEncontradoError('Ambulancia');
    if (await this.turnosRepositorio.buscarActivoDeAmbulancia(ambulancia.id)) {
      throw new ConflictoNegocioError(
        `La ambulancia ${ambulancia.codigo} ya tiene un turno activo`,
      );
    }

    const nuevo = Turno.iniciar({
      ambulanciaId: ambulancia.id,
      integrantes: datos.integrantes,
      inicio: new Date(),
    });
    await this.validadorTripulacion.validar(datos.integrantes);

    const turno = await this.turnosRepositorio.crear(nuevo);

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'turnos',
      entidadId: turno.id,
      accion: 'iniciar',
      detalle: {
        ambulanciaId: ambulancia.id,
        integrantes: datos.integrantes.map((i) => ({ ...i })),
      },
      direccionIp: contexto.direccionIp,
    });
    this.eventos.publicar({
      tipo: 'turno.actualizado',
      turnoId: turno.id,
      usuariosAfectados: turno.integrantes.map((i) => i.usuarioId),
    });

    return turno;
  }
}
