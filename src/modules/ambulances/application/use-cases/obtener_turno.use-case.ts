import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type { Turno } from '../../domain/entities/turno.entity.js';
import { TurnosRepositorio } from '../../domain/repositories/turnos.repository.js';

@Injectable()
export class ObtenerTurno {
  constructor(private readonly turnosRepositorio: TurnosRepositorio) {}

  async ejecutar(turnoId: string): Promise<Turno> {
    const turno = await this.turnosRepositorio.buscarPorId(turnoId);
    if (!turno) throw new RecursoNoEncontradoError('Turno');
    return turno;
  }
}
