import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { fechaColombia } from '../../../../common/utils/fecha_colombia.js';
import { describirExistencia } from '../../domain/entities/existencia.js';
import {
  type EstadoConteo,
  type TipoVerificacion,
  Verificacion,
} from '../../domain/entities/verificacion.entity.js';
import { ExistenciasRepositorio } from '../../domain/repositories/existencias.repository.js';
import { VerificacionesRepositorio } from '../../domain/repositories/verificaciones.repository.js';
import { claveControl } from '../../domain/services/identificacion_unidad.js';
import { AuditoriaInventario } from '../services/auditoria_inventario.service.js';
import {
  type PedidoUnidad,
  ReferenciasInventario,
} from '../services/referencias_inventario.service.js';
import { UbicacionDelParamedico } from '../services/ubicacion_del_paramedico.service.js';
import { ConsultarExistencias } from './consultar_existencias.use-case.js';

export interface ConteoEntrada extends PedidoUnidad {
  cantidadEncontrada: number;
  estado: EstadoConteo | null;
  observaciones: string | null;
}

/**
 * Verificación del inventario de la ambulancia por su paramédico: una abierta
 * a la vez; se cuenta por partes y al final queda completada o con novedades.
 */
@Injectable()
export class VerificarInventarioAmbulancia {
  constructor(
    private readonly ubicacionDelParamedico: UbicacionDelParamedico,
    private readonly verificaciones: VerificacionesRepositorio,
    private readonly existencias: ExistenciasRepositorio,
    private readonly consultarExistencias: ConsultarExistencias,
    private readonly referencias: ReferenciasInventario,
    private readonly auditoria: AuditoriaInventario,
  ) {}

  /** La abierta de su ambulancia, o `null`. */
  async abierta(contexto: ContextoSolicitud): Promise<Verificacion | null> {
    const { ubicacion } = await this.ubicacionDelParamedico.obtener(
      contexto.usuarioId,
    );
    return this.verificaciones.buscarBorradorDeUbicacion(ubicacion.id);
  }

  /** Si ya hay una abierta, la devuelve (`creada: false`) en lugar de abrir otra. */
  async iniciar(
    datos: { tipo: TipoVerificacion; observaciones: string | null },
    contexto: ContextoSolicitud,
    ahora: Date = new Date(),
  ): Promise<{ verificacion: Verificacion; creada: boolean }> {
    const paramedico = await this.ubicacionDelParamedico.obtener(
      contexto.usuarioId,
      ahora,
    );
    const resultado = await this.verificaciones.crear(
      Verificacion.iniciar(
        {
          ubicacionId: paramedico.ubicacion.id,
          turnoId: paramedico.turno.id,
          responsableId: paramedico.paramedicoId,
          tipo: datos.tipo,
          observaciones: datos.observaciones,
        },
        ahora,
      ),
    );
    if (resultado.creada) {
      await this.auditoria.registrar(
        contexto,
        'inv_verificaciones',
        resultado.verificacion.id,
        'iniciar',
        { tipo: datos.tipo, ubicacionId: paramedico.ubicacion.id },
      );
    }
    return resultado;
  }

  /**
   * Lo esperado sale de las existencias del sistema, nunca del celular; el
   * elemento del perfil se enlaza si el insumo hace parte de la dotación.
   */
  async registrarConteos(
    conteos: ConteoEntrada[],
    contexto: ContextoSolicitud,
    ahora: Date = new Date(),
  ): Promise<Verificacion> {
    const paramedico = await this.ubicacionDelParamedico.obtener(
      contexto.usuarioId,
      ahora,
    );
    const verificacion = await this.exigirAbierta(paramedico.ubicacion.id);
    const hoy = fechaColombia(ahora);
    const [unidades, existencias, dotacion] = await Promise.all([
      this.referencias.unidades(conteos),
      this.existencias.deUbicacion(paramedico.ubicacion.id),
      this.consultarExistencias.dotacionDeAmbulancia(
        paramedico.ambulanciaId,
        ahora,
      ),
    ]);
    const cantidadPorClave = new Map(
      existencias.map((e) => [e.claveControl, e.cantidad]),
    );

    unidades.forEach((unidad, i) => {
      const conteo = conteos[i];
      if (!conteo) return;
      const clave = claveControl(
        unidad.insumo.id,
        unidad.lote?.id ?? null,
        unidad.equipo?.id ?? null,
      );
      verificacion.registrarConteo(
        {
          ...unidad,
          cantidadEncontrada: conteo.cantidadEncontrada,
          estado: conteo.estado,
          observaciones: conteo.observaciones,
        },
        {
          cantidadEsperada: cantidadPorClave.get(clave) ?? 0,
          perfilDetalleId:
            dotacion.perfil?.buscarDetalleDeInsumo(unidad.insumo.id)?.id ??
            null,
          hoy,
        },
        ahora,
      );
    });
    return this.verificaciones.guardarConteos(verificacion);
  }

  async finalizar(
    observaciones: string | null,
    contexto: ContextoSolicitud,
    ahora: Date = new Date(),
  ): Promise<Verificacion> {
    const paramedico = await this.ubicacionDelParamedico.obtener(
      contexto.usuarioId,
      ahora,
    );
    const verificacion = await this.exigirAbierta(paramedico.ubicacion.id);
    const existencias = await this.existencias.deUbicacion(
      paramedico.ubicacion.id,
    );
    const pendientes = new Set(
      verificacion.sinContar(existencias.map((e) => e.claveControl)),
    );
    verificacion.finalizar(
      existencias
        .filter((e) => pendientes.has(e.claveControl))
        .map(describirExistencia),
      observaciones,
      ahora,
    );
    const finalizada = await this.verificaciones.finalizar(verificacion);
    await this.auditoria.registrar(
      contexto,
      'inv_verificaciones',
      finalizada.id,
      'finalizar',
      {
        estado: finalizada.estado,
        conteos: finalizada.conteos.length,
        novedades: finalizada.conteos.filter((c) => c.estado !== 'conforme')
          .length,
      },
    );
    return finalizada;
  }

  private async exigirAbierta(ubicacionId: string): Promise<Verificacion> {
    const verificacion =
      await this.verificaciones.buscarBorradorDeUbicacion(ubicacionId);
    if (!verificacion) {
      throw new RecursoNoEncontradoError(
        'Verificación abierta de la ambulancia',
      );
    }
    return verificacion;
  }
}
