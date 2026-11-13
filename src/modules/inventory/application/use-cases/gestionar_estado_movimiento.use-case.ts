import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { fechaColombia } from '../../../../common/utils/fecha_colombia.js';
import type { Movimiento } from '../../domain/entities/movimiento.entity.js';
import { MovimientosRepositorio } from '../../domain/repositories/movimientos.repository.js';
import { textoObligatorio } from '../../domain/services/validaciones.js';
import {
  AuditoriaInventario,
  usuarioDe,
} from '../services/auditoria_inventario.service.js';

/**
 * Un borrador se confirma (cambia existencias) o se anula (queda como
 * constancia). Uno confirmado ya no se toca: se corrige con un ajuste.
 */
@Injectable()
export class GestionarEstadoMovimiento {
  constructor(
    private readonly movimientos: MovimientosRepositorio,
    private readonly auditoria: AuditoriaInventario,
  ) {}

  async confirmar(
    id: string,
    contexto: ContextoSolicitud,
  ): Promise<Movimiento> {
    usuarioDe(contexto);
    const ahora = new Date();
    const movimiento = await this.obtener(id);
    movimiento.confirmar(ahora, fechaColombia(ahora));
    const confirmado = await this.movimientos.confirmar(movimiento);
    await this.auditoria.registrar(
      contexto,
      'inv_movimientos',
      id,
      'confirmar',
      {
        codigo: confirmado.codigo,
        tipo: confirmado.tipo,
      },
    );
    return confirmado;
  }

  async anular(
    id: string,
    motivo: string,
    contexto: ContextoSolicitud,
  ): Promise<Movimiento> {
    usuarioDe(contexto);
    const razon = textoObligatorio(motivo, 'El motivo de la anulación', 150);
    const movimiento = await this.obtener(id);
    movimiento.anular(new Date());
    const anulado = await this.movimientos.anular(movimiento);
    await this.auditoria.registrar(contexto, 'inv_movimientos', id, 'anular', {
      codigo: anulado.codigo,
      motivo: razon,
    });
    return anulado;
  }

  private async obtener(id: string): Promise<Movimiento> {
    const movimiento = await this.movimientos.buscarPorId(id);
    if (!movimiento) throw new RecursoNoEncontradoError('Movimiento');
    return movimiento;
  }
}
