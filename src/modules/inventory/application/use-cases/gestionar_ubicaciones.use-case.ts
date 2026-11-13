import { Injectable } from '@nestjs/common';
import {
  RecursoNoEncontradoError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AmbulanciasRepositorio } from '../../../ambulances/domain/repositories/ambulancias.repository.js';
import { UbicacionInventario } from '../../domain/entities/ubicacion_inventario.entity.js';
import {
  type FiltrosUbicaciones,
  UbicacionesInventarioRepositorio,
} from '../../domain/repositories/ubicaciones_inventario.repository.js';
import {
  AuditoriaInventario,
  usuarioDe,
} from '../services/auditoria_inventario.service.js';
import { ReferenciasInventario } from '../services/referencias_inventario.service.js';

/**
 * Las bodegas crean su ubicación al nacer. Las ambulancias se habilitan aquí
 * (o solas, la primera vez que su paramédico abre el inventario).
 */
@Injectable()
export class GestionarUbicaciones {
  constructor(
    private readonly ubicaciones: UbicacionesInventarioRepositorio,
    private readonly ambulancias: AmbulanciasRepositorio,
    private readonly referencias: ReferenciasInventario,
    private readonly auditoria: AuditoriaInventario,
  ) {}

  async habilitarAmbulancia(
    ambulanciaId: string,
    contexto: ContextoSolicitud,
  ): Promise<{ ubicacion: UbicacionInventario; creada: boolean }> {
    usuarioDe(contexto);
    if (!(await this.ambulancias.buscarPorId(ambulanciaId))) {
      throw new RecursoNoEncontradoError('Ambulancia');
    }
    const resultado = await this.ubicaciones.asegurarDeAmbulancia(
      UbicacionInventario.deAmbulancia(ambulanciaId, new Date()),
    );
    if (resultado.creada) {
      await this.auditoria.registrar(
        contexto,
        'inv_ubicaciones',
        resultado.ubicacion.id,
        'crear',
        { ambulanciaId },
      );
    }
    return resultado;
  }

  /** Solo las de ambulancias: la de una bodega sigue el estado de la bodega. */
  async cambiarEstado(
    id: string,
    activa: boolean,
    contexto: ContextoSolicitud,
  ): Promise<UbicacionInventario> {
    usuarioDe(contexto);
    const ubicacion = await this.referencias.ubicacion(id);
    if (!ubicacion.esAmbulancia()) {
      throw new ReglaNegocioError(
        'Active o desactive la bodega, no su ubicación',
      );
    }
    ubicacion.cambiarEstado(activa);
    const actualizada = await this.ubicaciones.cambiarEstado(ubicacion);
    await this.auditoria.registrar(
      contexto,
      'inv_ubicaciones',
      id,
      activa ? 'activar' : 'desactivar',
    );
    return actualizada;
  }

  listar(filtros: FiltrosUbicaciones): Promise<UbicacionInventario[]> {
    return this.ubicaciones.listar(filtros);
  }

  obtener(id: string): Promise<UbicacionInventario> {
    return this.referencias.ubicacion(id);
  }
}
