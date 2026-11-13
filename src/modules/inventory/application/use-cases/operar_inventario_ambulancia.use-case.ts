import { Injectable } from '@nestjs/common';
import {
  RecursoNoEncontradoError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import type { Bodega } from '../../domain/entities/bodega.entity.js';
import type { Movimiento } from '../../domain/entities/movimiento.entity.js';
import type { Verificacion } from '../../domain/entities/verificacion.entity.js';
import { BodegasRepositorio } from '../../domain/repositories/bodegas.repository.js';
import { VerificacionesRepositorio } from '../../domain/repositories/verificaciones.repository.js';
import {
  type ParamedicoEnAmbulancia,
  UbicacionDelParamedico,
} from '../services/ubicacion_del_paramedico.service.js';
import {
  ConsultarExistencias,
  type DotacionAmbulancia,
} from './consultar_existencias.use-case.js';
import {
  type LineaMovimientoEntrada,
  RegistrarMovimiento,
} from './registrar_movimiento.use-case.js';

export interface MiInventario extends DotacionAmbulancia {
  /** La verificación en curso de la ambulancia, si hay una. */
  verificacionAbierta: Verificacion | null;
}

export interface ConsumoEntrada {
  lineas: LineaMovimientoEntrada[];
  asignacionId: string | null;
  observaciones: string | null;
}

export interface DevolucionEntrada {
  bodegaId: string;
  lineas: LineaMovimientoEntrada[];
  motivo: string | null;
  observaciones: string | null;
}

/**
 * Lo que hace el paramédico con el inventario de su ambulancia. La ambulancia
 * sale de su turno; nunca del cuerpo de la solicitud.
 */
@Injectable()
export class OperarInventarioAmbulancia {
  constructor(
    private readonly ubicacionDelParamedico: UbicacionDelParamedico,
    private readonly consultarExistencias: ConsultarExistencias,
    private readonly registrarMovimiento: RegistrarMovimiento,
    private readonly bodegas: BodegasRepositorio,
    private readonly verificaciones: VerificacionesRepositorio,
  ) {}

  async miInventario(contexto: ContextoSolicitud): Promise<MiInventario> {
    const { ambulanciaId, ubicacion } = await this.paramedico(contexto);
    const [dotacion, verificacionAbierta] = await Promise.all([
      this.consultarExistencias.dotacionDeAmbulancia(ambulanciaId),
      this.verificaciones.buscarBorradorDeUbicacion(ubicacion.id),
    ]);
    return { ...dotacion, ubicacion, verificacionAbierta };
  }

  /** Lo usado con pacientes: se confirma de una vez y descuenta de la ambulancia. */
  async registrarConsumo(
    entrada: ConsumoEntrada,
    contexto: ContextoSolicitud,
  ): Promise<Movimiento> {
    const paramedico = await this.paramedico(contexto);
    if (entrada.asignacionId) {
      const asignacion = await this.registrarMovimiento.asignacion(
        entrada.asignacionId,
      );
      // Un servicio de otro turno de la misma ambulancia no es de este paramédico.
      if (asignacion.turnoId && asignacion.turnoId !== paramedico.turno.id) {
        throw new ReglaNegocioError('El servicio no pertenece a su turno');
      }
    }
    return this.registrarMovimiento.ejecutar(
      {
        tipo: 'consumo',
        origenUbicacionId: paramedico.ubicacion.id,
        lineas: entrada.lineas,
        asignacionId: entrada.asignacionId,
        observaciones: entrada.observaciones,
        confirmar: true,
      },
      contexto,
    );
  }

  /**
   * Queda en borrador: lo devuelto sigue en la ambulancia hasta que la bodega
   * lo recibe y confirma el movimiento.
   */
  async registrarDevolucion(
    entrada: DevolucionEntrada,
    contexto: ContextoSolicitud,
  ): Promise<Movimiento> {
    const paramedico = await this.paramedico(contexto);
    const bodega = await this.bodegas.buscarPorId(entrada.bodegaId);
    if (!bodega?.ubicacionInventarioId)
      throw new RecursoNoEncontradoError('Bodega');
    return this.registrarMovimiento.ejecutar(
      {
        tipo: 'devolucion',
        origenUbicacionId: paramedico.ubicacion.id,
        destinoUbicacionId: bodega.ubicacionInventarioId,
        lineas: entrada.lineas,
        motivo: entrada.motivo,
        observaciones: entrada.observaciones,
        confirmar: false,
      },
      contexto,
    );
  }

  /** Las bodegas activas, para elegir a cuál devolver. */
  async bodegasDisponibles(): Promise<Bodega[]> {
    const { datos } = await this.bodegas.listar(
      { activa: true },
      { pagina: 1, limite: 100 },
    );
    return datos;
  }

  paramedico(contexto: ContextoSolicitud): Promise<ParamedicoEnAmbulancia> {
    return this.ubicacionDelParamedico.obtener(contexto.usuarioId);
  }
}
