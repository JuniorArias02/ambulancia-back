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
import { fechaColombia } from '../../../../common/utils/fecha_colombia.js';
import { TiposAmbulanciaRepositorio } from '../../../ambulances/domain/repositories/tipos_ambulancia.repository.js';
import {
  type DatosDetallePerfil,
  type DatosPerfil,
  PerfilDotacion,
} from '../../domain/entities/perfil_dotacion.entity.js';
import {
  type FiltrosPerfilesDotacion,
  PerfilesDotacionRepositorio,
} from '../../domain/repositories/perfiles_dotacion.repository.js';
import { codigo } from '../../domain/services/validaciones.js';
import {
  AuditoriaInventario,
  camposEnviados,
  usuarioDe,
} from '../services/auditoria_inventario.service.js';
import { ReferenciasInventario } from '../services/referencias_inventario.service.js';

export interface DetallePerfilEntrada extends DatosDetallePerfil {
  insumoId: string;
}

export interface CrearPerfilEntrada extends DatosPerfil {
  tipoAmbulanciaId: string;
  codigo: string;
  detalles: DetallePerfilEntrada[];
}

@Injectable()
export class GestionarPerfilesDotacion {
  constructor(
    private readonly perfiles: PerfilesDotacionRepositorio,
    private readonly tiposAmbulancia: TiposAmbulanciaRepositorio,
    private readonly referencias: ReferenciasInventario,
    private readonly auditoria: AuditoriaInventario,
  ) {}

  /** Crea la versión 1 de un código. Para cambiar uno existente se crea una versión nueva. */
  async crear(
    datos: CrearPerfilEntrada,
    contexto: ContextoSolicitud,
  ): Promise<PerfilDotacion> {
    usuarioDe(contexto);
    if (!(await this.tiposAmbulancia.buscarPorId(datos.tipoAmbulanciaId))) {
      throw new RecursoNoEncontradoError('Tipo de ambulancia');
    }
    const codigoPerfil = codigo(datos.codigo, 'El código');
    const version = await this.perfiles.siguienteVersion(
      datos.tipoAmbulanciaId,
      codigoPerfil,
    );
    if (version > 1) {
      throw new ConflictoNegocioError(
        `El perfil ${codigoPerfil} ya existe para este tipo: cree una versión nueva`,
      );
    }
    const unidades = await this.referencias.unidades(
      datos.detalles.map((d) => ({ insumoId: d.insumoId })),
    );
    const perfil = PerfilDotacion.crear(
      {
        ...datos,
        codigo: codigoPerfil,
        detalles: datos.detalles.map((detalle, i) => ({
          ...detalle,
          insumo: unidades[i]?.insumo ?? this.imposible(),
        })),
      },
      version,
      new Date(),
    );
    const creado = await this.perfiles.crear(perfil);
    await this.auditoria.registrar(
      contexto,
      'inv_perfiles_dotacion',
      creado.id,
      'crear',
      {
        codigo: creado.codigo,
        version: creado.version,
        elementos: creado.detalles.length,
      },
    );
    return creado;
  }

  /** Copia el perfil con la versión siguiente, inactiva, para ajustarla y activarla. */
  async nuevaVersion(
    id: string,
    contexto: ContextoSolicitud,
  ): Promise<PerfilDotacion> {
    usuarioDe(contexto);
    const base = await this.obtener(id);
    const version = await this.perfiles.siguienteVersion(
      base.tipoAmbulanciaId,
      base.codigo,
    );
    const creado = await this.perfiles.crear(
      base.nuevaVersion(version, new Date()),
    );
    await this.auditoria.registrar(
      contexto,
      'inv_perfiles_dotacion',
      creado.id,
      'nueva_version',
      {
        codigo: creado.codigo,
        version,
        desde: base.id,
      },
    );
    return creado;
  }

  async actualizar(
    id: string,
    cambios: Partial<DatosPerfil>,
    contexto: ContextoSolicitud,
  ): Promise<PerfilDotacion> {
    usuarioDe(contexto);
    const perfil = await this.obtener(id);
    perfil.actualizar(cambios, new Date());
    const guardado = await this.perfiles.guardar(perfil);
    await this.auditoria.registrar(
      contexto,
      'inv_perfiles_dotacion',
      id,
      'editar',
      {
        campos: camposEnviados(cambios),
      },
    );
    return guardado;
  }

  /** Activar uno desactiva los demás del mismo tipo de ambulancia. */
  async cambiarEstado(
    id: string,
    activo: boolean,
    contexto: ContextoSolicitud,
  ): Promise<PerfilDotacion> {
    usuarioDe(contexto);
    const ahora = new Date();
    const perfil = await this.obtener(id);
    let guardado: PerfilDotacion;
    if (activo) {
      perfil.activar(fechaColombia(ahora), ahora);
      guardado = await this.perfiles.activarUnico(perfil);
    } else {
      perfil.desactivar(ahora);
      guardado = await this.perfiles.guardar(perfil);
    }
    await this.auditoria.registrar(
      contexto,
      'inv_perfiles_dotacion',
      id,
      activo ? 'activar' : 'desactivar',
      { codigo: guardado.codigo, version: guardado.version },
    );
    return guardado;
  }

  async agregarDetalle(
    id: string,
    datos: DetallePerfilEntrada,
    contexto: ContextoSolicitud,
  ): Promise<PerfilDotacion> {
    usuarioDe(contexto);
    const perfil = await this.obtener(id);
    const insumo = await this.referencias.insumo(datos.insumoId);
    perfil.agregarDetalle(insumo, datos, new Date());
    return this.guardarDetalle(perfil, contexto, 'agregar_elemento', {
      insumoId: insumo.id,
    });
  }

  async actualizarDetalle(
    id: string,
    detalleId: string,
    cambios: Partial<DatosDetallePerfil>,
    contexto: ContextoSolicitud,
  ): Promise<PerfilDotacion> {
    usuarioDe(contexto);
    const perfil = await this.obtener(id);
    perfil.actualizarDetalle(detalleId, cambios, new Date());
    return this.guardarDetalle(perfil, contexto, 'editar_elemento', {
      detalleId,
    });
  }

  async quitarDetalle(
    id: string,
    detalleId: string,
    contexto: ContextoSolicitud,
  ): Promise<PerfilDotacion> {
    usuarioDe(contexto);
    const perfil = await this.obtener(id);
    perfil.quitarDetalle(detalleId, new Date());
    return this.guardarDetalle(perfil, contexto, 'quitar_elemento', {
      detalleId,
    });
  }

  async obtener(id: string): Promise<PerfilDotacion> {
    const perfil = await this.perfiles.buscarPorId(id);
    if (!perfil) throw new RecursoNoEncontradoError('Perfil de dotación');
    return perfil;
  }

  listar(
    filtros: FiltrosPerfilesDotacion,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<PerfilDotacion>> {
    return this.perfiles.listar(filtros, paginacion);
  }

  private async guardarDetalle(
    perfil: PerfilDotacion,
    contexto: ContextoSolicitud,
    accion: string,
    detalle: { [clave: string]: string },
  ): Promise<PerfilDotacion> {
    const guardado = await this.perfiles.guardar(perfil);
    await this.auditoria.registrar(
      contexto,
      'inv_perfiles_dotacion',
      perfil.id,
      accion,
      detalle,
    );
    return guardado;
  }

  private imposible(): never {
    throw new Error('Cada elemento del perfil debe resolver su insumo');
  }
}
