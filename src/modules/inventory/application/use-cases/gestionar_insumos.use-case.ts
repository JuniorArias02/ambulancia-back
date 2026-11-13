import { Injectable } from '@nestjs/common';
import {
  ConflictoNegocioError,
  RecursoNoEncontradoError,
} from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import {
  type DatosInsumo,
  Insumo,
} from '../../domain/entities/insumo.entity.js';
import {
  type FiltrosInsumos,
  InsumosRepositorio,
} from '../../domain/repositories/insumos.repository.js';
import { codigo } from '../../domain/services/validaciones.js';
import {
  AuditoriaInventario,
  camposEnviados,
  usuarioDe,
} from '../services/auditoria_inventario.service.js';

@Injectable()
export class GestionarInsumos {
  constructor(
    private readonly insumos: InsumosRepositorio,
    private readonly auditoria: AuditoriaInventario,
  ) {}

  async crear(
    datos: DatosInsumo,
    contexto: ContextoSolicitud,
  ): Promise<Insumo> {
    usuarioDe(contexto);
    const insumo = Insumo.crear(datos, new Date());
    await this.exigirCodigoLibre(insumo.codigo);
    const creado = await this.insumos.crear(insumo);
    await this.auditoria.registrar(
      contexto,
      'inv_insumos',
      creado.id,
      'crear',
      {
        codigo: creado.codigo,
        tipo: creado.tipo,
      },
    );
    return creado;
  }

  async actualizar(
    id: string,
    cambios: Partial<DatosInsumo>,
    contexto: ContextoSolicitud,
  ): Promise<Insumo> {
    usuarioDe(contexto);
    const insumo = await this.obtener(id);
    // Cambiar lote/serie con existencias ya registradas rompería sus claves de control.
    if (
      insumo.cambiaControl(cambios) &&
      (await this.insumos.tieneHistorial(id))
    ) {
      throw new ConflictoNegocioError(
        'El insumo ya tiene existencias o movimientos: no se puede cambiar si se controla por lote o por serie',
      );
    }
    if (
      cambios.codigo !== undefined &&
      codigo(cambios.codigo, 'El código') !== insumo.codigo
    ) {
      await this.exigirCodigoLibre(codigo(cambios.codigo, 'El código'), id);
    }
    insumo.actualizar(cambios, new Date());
    const actualizado = await this.insumos.actualizar(insumo);
    await this.auditoria.registrar(contexto, 'inv_insumos', id, 'editar', {
      campos: camposEnviados(cambios),
    });
    return actualizado;
  }

  async cambiarEstado(
    id: string,
    activo: boolean,
    contexto: ContextoSolicitud,
  ): Promise<Insumo> {
    usuarioDe(contexto);
    const insumo = await this.obtener(id);
    insumo.cambiarEstado(activo, new Date());
    const actualizado = await this.insumos.actualizar(insumo);
    await this.auditoria.registrar(
      contexto,
      'inv_insumos',
      id,
      activo ? 'activar' : 'desactivar',
    );
    return actualizado;
  }

  async obtener(id: string): Promise<Insumo> {
    const insumo = await this.insumos.buscarPorId(id);
    if (!insumo) throw new RecursoNoEncontradoError('Insumo');
    return insumo;
  }

  listar(
    filtros: FiltrosInsumos,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<Insumo>> {
    return this.insumos.listar(filtros, paginacion);
  }

  private async exigirCodigoLibre(
    valor: string,
    excluirId?: string,
  ): Promise<void> {
    if (await this.insumos.existeCodigo(valor, excluirId)) {
      throw new ConflictoNegocioError(
        `Ya existe un insumo con el código ${valor}`,
      );
    }
  }
}
