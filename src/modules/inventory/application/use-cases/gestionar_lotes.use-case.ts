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
import {
  type CambiosLote,
  type DatosLote,
  Lote,
} from '../../domain/entities/lote.entity.js';
import type { RegistroSanitario } from '../../domain/entities/registro_sanitario.entity.js';
import {
  type FiltrosLotes,
  LotesRepositorio,
} from '../../domain/repositories/lotes.repository.js';
import { RegistrosSanitariosRepositorio } from '../../domain/repositories/registros_sanitarios.repository.js';
import {
  AuditoriaInventario,
  camposEnviados,
  usuarioDe,
} from '../services/auditoria_inventario.service.js';
import { ReferenciasInventario } from '../services/referencias_inventario.service.js';

export interface CrearLoteEntrada extends DatosLote {
  insumoId: string;
  registroSanitarioId: string | null;
}

@Injectable()
export class GestionarLotes {
  constructor(
    private readonly lotes: LotesRepositorio,
    private readonly registros: RegistrosSanitariosRepositorio,
    private readonly referencias: ReferenciasInventario,
    private readonly auditoria: AuditoriaInventario,
  ) {}

  async crear(
    datos: CrearLoteEntrada,
    contexto: ContextoSolicitud,
  ): Promise<Lote> {
    usuarioDe(contexto);
    const ahora = new Date();
    const insumo = await this.referencias.insumo(datos.insumoId);
    const registro = await this.registro(datos.registroSanitarioId);
    const lote = Lote.crear(
      insumo,
      registro,
      datos,
      ahora,
      fechaColombia(ahora),
    );
    if (await this.lotes.existeNumero(insumo.id, lote.numeroLote)) {
      throw new ConflictoNegocioError(
        `El lote ${lote.numeroLote} de "${insumo.nombre}" ya está registrado`,
      );
    }
    const creado = await this.lotes.crear(lote);
    await this.auditoria.registrar(contexto, 'inv_lotes', creado.id, 'crear', {
      insumoId: insumo.id,
      numeroLote: creado.numeroLote,
      fechaVencimiento: creado.fechaVencimiento,
    });
    return creado;
  }

  async actualizar(
    id: string,
    cambios: CambiosLote,
    contexto: ContextoSolicitud,
  ): Promise<Lote> {
    usuarioDe(contexto);
    const lote = await this.obtener(id);
    const vencimientoAnterior = lote.fechaVencimiento;
    lote.actualizar(cambios, fechaColombia(new Date()));
    const actualizado = await this.lotes.actualizar(lote);
    // El vencimiento decide si el lote puede ir a una ambulancia: su cambio queda trazado.
    await this.auditoria.registrar(contexto, 'inv_lotes', id, 'editar', {
      campos: camposEnviados(cambios),
      vencimientoAnterior,
      fechaVencimiento: actualizado.fechaVencimiento,
    });
    return actualizado;
  }

  async obtener(id: string): Promise<Lote> {
    const lote = await this.lotes.buscarPorId(id);
    if (!lote) throw new RecursoNoEncontradoError('Lote');
    return lote;
  }

  listar(
    filtros: FiltrosLotes,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<Lote>> {
    return this.lotes.listar(filtros, paginacion);
  }

  private async registro(id: string | null): Promise<RegistroSanitario | null> {
    if (!id) return null;
    const registro = await this.registros.buscarPorId(id);
    if (!registro) throw new RecursoNoEncontradoError('Registro sanitario');
    return registro;
  }
}
