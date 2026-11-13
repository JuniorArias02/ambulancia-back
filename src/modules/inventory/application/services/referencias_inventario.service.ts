import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type { Insumo } from '../../domain/entities/insumo.entity.js';
import type { UbicacionInventario } from '../../domain/entities/ubicacion_inventario.entity.js';
import { EquiposRepositorio } from '../../domain/repositories/equipos.repository.js';
import { InsumosRepositorio } from '../../domain/repositories/insumos.repository.js';
import { LotesRepositorio } from '../../domain/repositories/lotes.repository.js';
import { UbicacionesInventarioRepositorio } from '../../domain/repositories/ubicaciones_inventario.repository.js';
import type { ReferenciaUnidad } from '../../domain/services/identificacion_unidad.js';

/** Lo que envía el cliente para señalar una unidad: solo identificadores. */
export interface PedidoUnidad {
  insumoId: string;
  loteId?: string | null;
  equipoId?: string | null;
}

function unicos(ids: (string | null | undefined)[]): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

/**
 * Convierte identificadores en entidades (en lote, sin una consulta por fila)
 * y responde 404 si alguno no existe.
 */
@Injectable()
export class ReferenciasInventario {
  constructor(
    private readonly insumos: InsumosRepositorio,
    private readonly lotes: LotesRepositorio,
    private readonly equipos: EquiposRepositorio,
    private readonly ubicaciones: UbicacionesInventarioRepositorio,
  ) {}

  async insumo(id: string): Promise<Insumo> {
    const insumo = await this.insumos.buscarPorId(id);
    if (!insumo) throw new RecursoNoEncontradoError('Insumo');
    return insumo;
  }

  async ubicacion(id: string): Promise<UbicacionInventario> {
    const ubicacion = await this.ubicaciones.buscarPorId(id);
    if (!ubicacion)
      throw new RecursoNoEncontradoError('Ubicación de inventario');
    return ubicacion;
  }

  async ubicacionOpcional(
    id: string | null | undefined,
  ): Promise<UbicacionInventario | null> {
    return id ? this.ubicacion(id) : null;
  }

  async unidades(
    pedidos: readonly PedidoUnidad[],
  ): Promise<ReferenciaUnidad[]> {
    const [insumos, lotes, equipos] = await Promise.all([
      this.insumos.buscarVarios(unicos(pedidos.map((p) => p.insumoId))),
      this.lotes.buscarVarios(unicos(pedidos.map((p) => p.loteId))),
      this.equipos.buscarVarios(unicos(pedidos.map((p) => p.equipoId))),
    ]);
    const insumoPorId = new Map(insumos.map((i) => [i.id, i]));
    const lotePorId = new Map(lotes.map((l) => [l.id, l]));
    const equipoPorId = new Map(equipos.map((e) => [e.id, e]));

    return pedidos.map((pedido) => {
      const insumo = insumoPorId.get(pedido.insumoId);
      if (!insumo) throw new RecursoNoEncontradoError('Insumo');
      const lote = pedido.loteId ? lotePorId.get(pedido.loteId) : null;
      if (lote === undefined) throw new RecursoNoEncontradoError('Lote');
      const equipo = pedido.equipoId ? equipoPorId.get(pedido.equipoId) : null;
      if (equipo === undefined) throw new RecursoNoEncontradoError('Equipo');
      return { insumo, lote, equipo };
    });
  }
}
