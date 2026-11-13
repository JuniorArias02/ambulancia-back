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
  type DatosRegistroSanitario,
  RegistroSanitario,
} from '../../domain/entities/registro_sanitario.entity.js';
import {
  type FiltrosRegistrosSanitarios,
  RegistrosSanitariosRepositorio,
} from '../../domain/repositories/registros_sanitarios.repository.js';
import {
  AuditoriaInventario,
  camposEnviados,
  usuarioDe,
} from '../services/auditoria_inventario.service.js';
import { ReferenciasInventario } from '../services/referencias_inventario.service.js';

@Injectable()
export class GestionarRegistrosSanitarios {
  constructor(
    private readonly registros: RegistrosSanitariosRepositorio,
    private readonly referencias: ReferenciasInventario,
    private readonly auditoria: AuditoriaInventario,
  ) {}

  async crear(
    insumoId: string,
    datos: DatosRegistroSanitario,
    contexto: ContextoSolicitud,
  ): Promise<RegistroSanitario> {
    usuarioDe(contexto);
    const insumo = await this.referencias.insumo(insumoId);
    const registro = RegistroSanitario.crear(insumo, datos, new Date());
    await this.exigirNumeroLibre(insumoId, registro.numeroRegistro);
    const creado = await this.registros.crear(registro);
    await this.auditoria.registrar(
      contexto,
      'inv_registros_sanitarios',
      creado.id,
      'crear',
      {
        insumoId,
        numeroRegistro: creado.numeroRegistro,
      },
    );
    return creado;
  }

  async actualizar(
    id: string,
    cambios: Partial<DatosRegistroSanitario>,
    contexto: ContextoSolicitud,
  ): Promise<RegistroSanitario> {
    usuarioDe(contexto);
    const registro = await this.obtener(id);
    const estadoAnterior = registro.estado;
    registro.actualizar(cambios, new Date());
    await this.exigirNumeroLibre(
      registro.insumoId,
      registro.numeroRegistro,
      id,
    );
    const actualizado = await this.registros.actualizar(registro);
    await this.auditoria.registrar(
      contexto,
      'inv_registros_sanitarios',
      id,
      'editar',
      {
        campos: camposEnviados(cambios),
        estadoAnterior,
        estado: actualizado.estado,
      },
    );
    return actualizado;
  }

  async obtener(id: string): Promise<RegistroSanitario> {
    const registro = await this.registros.buscarPorId(id);
    if (!registro) throw new RecursoNoEncontradoError('Registro sanitario');
    return registro;
  }

  listar(
    filtros: FiltrosRegistrosSanitarios,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<RegistroSanitario>> {
    return this.registros.listar(filtros, paginacion);
  }

  private async exigirNumeroLibre(
    insumoId: string,
    numero: string,
    excluirId?: string,
  ): Promise<void> {
    if (await this.registros.existeNumero(insumoId, numero, excluirId)) {
      throw new ConflictoNegocioError(
        `El registro ${numero} ya existe para este insumo`,
      );
    }
  }
}
