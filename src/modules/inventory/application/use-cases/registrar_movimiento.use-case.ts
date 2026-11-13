import { Injectable } from '@nestjs/common';
import {
  RecursoNoEncontradoError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { fechaColombia } from '../../../../common/utils/fecha_colombia.js';
import type { Asignacion } from '../../../assignments/domain/entities/asignacion.entity.js';
import { AsignacionesRepositorio } from '../../../assignments/domain/repositories/asignaciones.repository.js';
import {
  Movimiento,
  type TipoMovimiento,
} from '../../domain/entities/movimiento.entity.js';
import type { UbicacionInventario } from '../../domain/entities/ubicacion_inventario.entity.js';
import { MovimientosRepositorio } from '../../domain/repositories/movimientos.repository.js';
import {
  AuditoriaInventario,
  usuarioDe,
} from '../services/auditoria_inventario.service.js';
import {
  type PedidoUnidad,
  ReferenciasInventario,
} from '../services/referencias_inventario.service.js';

export interface LineaMovimientoEntrada extends PedidoUnidad {
  cantidad: number;
  observaciones?: string | null;
}

export interface RegistrarMovimientoEntrada {
  tipo: TipoMovimiento;
  origenUbicacionId?: string | null;
  destinoUbicacionId?: string | null;
  lineas: LineaMovimientoEntrada[];
  asignacionId?: string | null;
  motivo?: string | null;
  observaciones?: string | null;
  documentoReferencia?: string | null;
  realizadoEn?: Date | null;
  /** `true` lo confirma de una vez y cambia las existencias. */
  confirmar: boolean;
}

@Injectable()
export class RegistrarMovimiento {
  constructor(
    private readonly movimientos: MovimientosRepositorio,
    private readonly asignaciones: AsignacionesRepositorio,
    private readonly referencias: ReferenciasInventario,
    private readonly auditoria: AuditoriaInventario,
  ) {}

  async ejecutar(
    entrada: RegistrarMovimientoEntrada,
    contexto: ContextoSolicitud,
    ahora: Date = new Date(),
  ): Promise<Movimiento> {
    const usuarioId = usuarioDe(contexto);
    const [origen, destino, unidades] = await Promise.all([
      this.referencias.ubicacionOpcional(entrada.origenUbicacionId),
      this.referencias.ubicacionOpcional(entrada.destinoUbicacionId),
      this.referencias.unidades(entrada.lineas),
    ]);
    if (entrada.asignacionId) {
      this.exigirAsignacionDeLaAmbulancia(
        await this.asignacion(entrada.asignacionId),
        origen,
      );
    }

    const movimiento = Movimiento.crear(
      {
        tipo: entrada.tipo,
        origen,
        destino,
        lineas: unidades.map((unidad, i) => ({
          ...unidad,
          cantidad: entrada.lineas[i]?.cantidad ?? 0,
          observaciones: entrada.lineas[i]?.observaciones ?? null,
        })),
        usuarioId,
        asignacionId: entrada.asignacionId ?? null,
        motivo: entrada.motivo ?? null,
        observaciones: entrada.observaciones ?? null,
        documentoReferencia: entrada.documentoReferencia ?? null,
        realizadoEn: entrada.realizadoEn ?? null,
      },
      ahora,
    );
    if (entrada.confirmar) movimiento.confirmar(ahora, fechaColombia(ahora));

    const registrado = await this.movimientos.registrar(movimiento);
    await this.auditoria.registrar(
      contexto,
      'inv_movimientos',
      registrado.id,
      'crear',
      {
        codigo: registrado.codigo,
        tipo: registrado.tipo,
        estado: registrado.estado,
        origen: registrado.origen?.id ?? null,
        destino: registrado.destino?.id ?? null,
        lineas: registrado.lineas.length,
      },
    );
    return registrado;
  }

  async asignacion(asignacionId: string): Promise<Asignacion> {
    const asignacion = await this.asignaciones.buscarPorId(asignacionId);
    if (!asignacion) throw new RecursoNoEncontradoError('Servicio');
    return asignacion;
  }

  /** Lo consumido en un servicio sale de la ambulancia que lo atendió. */
  private exigirAsignacionDeLaAmbulancia(
    asignacion: Asignacion,
    origen: UbicacionInventario | null,
  ): void {
    if (
      !origen?.esAmbulancia() ||
      origen.ambulanciaId !== asignacion.ambulanciaId
    ) {
      throw new ReglaNegocioError(
        'El servicio no fue atendido por esta ambulancia',
      );
    }
  }
}
