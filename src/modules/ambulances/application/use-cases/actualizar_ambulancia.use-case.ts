import { Injectable } from '@nestjs/common';
import {
  ConflictoNegocioError,
  RecursoNoEncontradoError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import { PublicadorEventos } from '../../../../common/events/publicador_eventos.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type { Ambulancia } from '../../domain/entities/ambulancia.entity.js';
import type { TipoAmbulancia } from '../../domain/entities/tipo_ambulancia.entity.js';
import { AmbulanciasRepositorio } from '../../domain/repositories/ambulancias.repository.js';
import { TiposAmbulanciaRepositorio } from '../../domain/repositories/tipos_ambulancia.repository.js';

export interface ActualizarAmbulanciaEntrada {
  codigo?: string;
  placa?: string;
  tipoAmbulanciaId?: string;
}

@Injectable()
export class ActualizarAmbulancia {
  constructor(
    private readonly ambulanciasRepositorio: AmbulanciasRepositorio,
    private readonly tiposAmbulanciaRepositorio: TiposAmbulanciaRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
    private readonly eventos: PublicadorEventos,
  ) {}

  async ejecutar(
    ambulanciaId: string,
    datos: ActualizarAmbulanciaEntrada,
    contexto: ContextoSolicitud,
  ): Promise<Ambulancia> {
    const ambulancia =
      await this.ambulanciasRepositorio.buscarPorId(ambulanciaId);
    if (!ambulancia) throw new RecursoNoEncontradoError('Ambulancia');

    let tipo: TipoAmbulancia | undefined;
    if (datos.tipoAmbulanciaId !== undefined) {
      const encontrado = await this.tiposAmbulanciaRepositorio.buscarPorId(
        datos.tipoAmbulanciaId,
      );
      if (!encontrado) {
        throw new ReglaNegocioError('El tipo de ambulancia no existe');
      }
      tipo = encontrado;
    }

    ambulancia.actualizarDatos({
      codigo: datos.codigo,
      placa: datos.placa,
      tipo,
    });

    if (
      await this.ambulanciasRepositorio.existeCodigo(
        ambulancia.codigo,
        ambulancia.id,
      )
    ) {
      throw new ConflictoNegocioError(
        'Ya existe una ambulancia con ese código',
      );
    }
    if (
      await this.ambulanciasRepositorio.existePlaca(
        ambulancia.placa,
        ambulancia.id,
      )
    ) {
      throw new ConflictoNegocioError('Ya existe una ambulancia con esa placa');
    }

    const actualizada =
      await this.ambulanciasRepositorio.actualizar(ambulancia);

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'ambulancias',
      entidadId: ambulancia.id,
      accion: 'actualizar',
      detalle: {
        campos: Object.entries(datos)
          .filter(([, valor]) => valor !== undefined)
          .map(([campo]) => campo),
      },
      direccionIp: contexto.direccionIp,
    });
    this.eventos.publicar({
      tipo: 'ambulancia.actualizada',
      ambulanciaId: ambulancia.id,
    });

    return actualizada;
  }
}
