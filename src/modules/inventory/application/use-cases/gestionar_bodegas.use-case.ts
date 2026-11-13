import { Injectable } from '@nestjs/common';
import { ROLES_INTERNOS } from '../../../../common/constants/roles.js';
import {
  ConflictoNegocioError,
  RecursoNoEncontradoError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import { UsuariosRepositorio } from '../../../users/domain/repositories/usuarios.repository.js';
import {
  Bodega,
  type DatosBodega,
} from '../../domain/entities/bodega.entity.js';
import { UbicacionInventario } from '../../domain/entities/ubicacion_inventario.entity.js';
import {
  BodegasRepositorio,
  type FiltrosBodegas,
} from '../../domain/repositories/bodegas.repository.js';
import { codigo } from '../../domain/services/validaciones.js';
import {
  AuditoriaInventario,
  camposEnviados,
  usuarioDe,
} from '../services/auditoria_inventario.service.js';

@Injectable()
export class GestionarBodegas {
  constructor(
    private readonly bodegas: BodegasRepositorio,
    private readonly usuarios: UsuariosRepositorio,
    private readonly auditoria: AuditoriaInventario,
  ) {}

  async crear(
    datos: DatosBodega,
    contexto: ContextoSolicitud,
  ): Promise<Bodega> {
    usuarioDe(contexto);
    const ahora = new Date();
    const bodega = Bodega.crear(datos, ahora);
    await this.exigirCodigoLibre(bodega.codigo);
    await this.exigirResponsableValido(bodega.responsableId);
    const creada = await this.bodegas.crear(
      bodega,
      UbicacionInventario.deBodega(bodega.id, ahora),
    );
    await this.auditoria.registrar(
      contexto,
      'inv_bodegas',
      creada.id,
      'crear',
      {
        codigo: creada.codigo,
      },
    );
    return creada;
  }

  async actualizar(
    id: string,
    cambios: Partial<DatosBodega>,
    contexto: ContextoSolicitud,
  ): Promise<Bodega> {
    usuarioDe(contexto);
    const bodega = await this.obtener(id);
    if (cambios.codigo !== undefined) {
      await this.exigirCodigoLibre(codigo(cambios.codigo, 'El código'), id);
    }
    if (cambios.responsableId !== undefined) {
      await this.exigirResponsableValido(cambios.responsableId);
    }
    bodega.actualizar(cambios, new Date());
    const actualizada = await this.bodegas.actualizar(bodega);
    await this.auditoria.registrar(contexto, 'inv_bodegas', id, 'editar', {
      campos: camposEnviados(cambios),
    });
    return actualizada;
  }

  /** Desactivarla también bloquea su ubicación: no recibe ni entrega más movimientos. */
  async cambiarEstado(
    id: string,
    activa: boolean,
    contexto: ContextoSolicitud,
  ): Promise<Bodega> {
    usuarioDe(contexto);
    const bodega = await this.obtener(id);
    bodega.cambiarEstado(activa, new Date());
    const actualizada = await this.bodegas.actualizar(bodega);
    await this.auditoria.registrar(
      contexto,
      'inv_bodegas',
      id,
      activa ? 'activar' : 'desactivar',
    );
    return actualizada;
  }

  async obtener(id: string): Promise<Bodega> {
    const bodega = await this.bodegas.buscarPorId(id);
    if (!bodega) throw new RecursoNoEncontradoError('Bodega');
    return bodega;
  }

  listar(
    filtros: FiltrosBodegas,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<Bodega>> {
    return this.bodegas.listar(filtros, paginacion);
  }

  private async exigirCodigoLibre(
    valor: string,
    excluirId?: string,
  ): Promise<void> {
    if (await this.bodegas.existeCodigo(valor, excluirId)) {
      throw new ConflictoNegocioError(
        `Ya existe una bodega con el código ${valor}`,
      );
    }
  }

  /** El responsable es personal interno activo, nunca un ciudadano. */
  private async exigirResponsableValido(
    responsableId: string | null,
  ): Promise<void> {
    if (!responsableId) return;
    const usuario = await this.usuarios.buscarPorId(responsableId);
    if (!usuario) throw new RecursoNoEncontradoError('Usuario responsable');
    if (!usuario.estaActivo() || !ROLES_INTERNOS.includes(usuario.rol)) {
      throw new ReglaNegocioError(
        'El responsable debe ser personal interno activo',
      );
    }
  }
}
