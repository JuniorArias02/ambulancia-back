import { Injectable } from '@nestjs/common';
import {
  ConflictoNegocioError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import { PublicadorEventos } from '../../../../common/events/publicador_eventos.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import { Ambulancia } from '../../domain/entities/ambulancia.entity.js';
import { AmbulanciasRepositorio } from '../../domain/repositories/ambulancias.repository.js';
import { TiposAmbulanciaRepositorio } from '../../domain/repositories/tipos_ambulancia.repository.js';

export interface CrearAmbulanciaEntrada {
  codigo: string;
  placa: string;
  tipoAmbulanciaId: string;
}

@Injectable()
export class CrearAmbulancia {
  constructor(
    private readonly ambulanciasRepositorio: AmbulanciasRepositorio,
    private readonly tiposAmbulanciaRepositorio: TiposAmbulanciaRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
    private readonly eventos: PublicadorEventos,
  ) {}

  async ejecutar(
    datos: CrearAmbulanciaEntrada,
    contexto: ContextoSolicitud,
  ): Promise<Ambulancia> {
    const tipo = await this.tiposAmbulanciaRepositorio.buscarPorId(
      datos.tipoAmbulanciaId,
    );
    if (!tipo) throw new ReglaNegocioError('El tipo de ambulancia no existe');

    const nueva = Ambulancia.crear({
      codigo: datos.codigo,
      placa: datos.placa,
      tipo,
    });
    if (await this.ambulanciasRepositorio.existeCodigo(nueva.codigo)) {
      throw new ConflictoNegocioError(
        'Ya existe una ambulancia con ese código',
      );
    }
    if (await this.ambulanciasRepositorio.existePlaca(nueva.placa)) {
      throw new ConflictoNegocioError('Ya existe una ambulancia con esa placa');
    }

    const ambulancia = await this.ambulanciasRepositorio.crear(nueva);

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'ambulancias',
      entidadId: ambulancia.id,
      accion: 'crear',
      detalle: { codigo: ambulancia.codigo, placa: ambulancia.placa },
      direccionIp: contexto.direccionIp,
    });
    this.eventos.publicar({
      tipo: 'ambulancia.actualizada',
      ambulanciaId: ambulancia.id,
    });

    return ambulancia;
  }
}
