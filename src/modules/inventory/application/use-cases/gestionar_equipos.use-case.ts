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
  type CambiosEquipo,
  type DatosEquipo,
  type DatosMantenimiento,
  Equipo,
  type EstadoEquipo,
  type Mantenimiento,
} from '../../domain/entities/equipo.entity.js';
import {
  EquiposRepositorio,
  type FiltrosEquipos,
} from '../../domain/repositories/equipos.repository.js';
import { RegistrosSanitariosRepositorio } from '../../domain/repositories/registros_sanitarios.repository.js';
import {
  AuditoriaInventario,
  camposEnviados,
  usuarioDe,
} from '../services/auditoria_inventario.service.js';
import { ReferenciasInventario } from '../services/referencias_inventario.service.js';

export interface CrearEquipoEntrada extends DatosEquipo {
  insumoId: string;
  registroSanitarioId: string | null;
}

@Injectable()
export class GestionarEquipos {
  constructor(
    private readonly equipos: EquiposRepositorio,
    private readonly registros: RegistrosSanitariosRepositorio,
    private readonly referencias: ReferenciasInventario,
    private readonly auditoria: AuditoriaInventario,
  ) {}

  async crear(
    datos: CrearEquipoEntrada,
    contexto: ContextoSolicitud,
  ): Promise<Equipo> {
    usuarioDe(contexto);
    const ahora = new Date();
    const insumo = await this.referencias.insumo(datos.insumoId);
    let registro = null;
    if (datos.registroSanitarioId) {
      registro = await this.registros.buscarPorId(datos.registroSanitarioId);
      if (!registro) throw new RecursoNoEncontradoError('Registro sanitario');
    }
    const equipo = Equipo.crear(
      insumo,
      registro,
      datos,
      ahora,
      fechaColombia(ahora),
    );
    if (await this.equipos.existeSerie(equipo.numeroSerie)) {
      throw new ConflictoNegocioError(
        `Ya existe un equipo con la serie ${equipo.numeroSerie}`,
      );
    }
    const creado = await this.equipos.crear(equipo);
    await this.auditoria.registrar(
      contexto,
      'inv_equipos',
      creado.id,
      'crear',
      {
        insumoId: insumo.id,
        numeroSerie: creado.numeroSerie,
      },
    );
    return creado;
  }

  async actualizar(
    id: string,
    cambios: CambiosEquipo,
    contexto: ContextoSolicitud,
  ): Promise<Equipo> {
    usuarioDe(contexto);
    const equipo = await this.obtener(id);
    const ahora = new Date();
    equipo.actualizar(cambios, ahora, fechaColombia(ahora));
    const actualizado = await this.equipos.actualizar(equipo);
    await this.auditoria.registrar(contexto, 'inv_equipos', id, 'editar', {
      campos: camposEnviados(cambios),
    });
    return actualizado;
  }

  async cambiarEstado(
    id: string,
    estado: EstadoEquipo,
    motivo: string | null,
    contexto: ContextoSolicitud,
  ): Promise<Equipo> {
    usuarioDe(contexto);
    const equipo = await this.obtener(id);
    const anterior = equipo.estado;
    equipo.cambiarEstado(estado, new Date());
    const actualizado = await this.equipos.actualizar(equipo);
    await this.auditoria.registrar(
      contexto,
      'inv_equipos',
      id,
      'cambiar_estado',
      {
        anterior,
        estado,
        motivo,
      },
    );
    return actualizado;
  }

  async registrarMantenimiento(
    id: string,
    datos: DatosMantenimiento,
    contexto: ContextoSolicitud,
  ): Promise<{ equipo: Equipo; mantenimiento: Mantenimiento }> {
    usuarioDe(contexto);
    const equipo = await this.obtener(id);
    const ahora = new Date();
    const mantenimiento = equipo.registrarMantenimiento(
      datos,
      ahora,
      fechaColombia(ahora),
    );
    const actualizado = await this.equipos.registrarMantenimiento(
      equipo,
      mantenimiento,
    );
    await this.auditoria.registrar(
      contexto,
      'inv_mantenimientos',
      mantenimiento.id,
      'crear',
      {
        equipoId: id,
        tipo: mantenimiento.tipo,
        fechaMantenimiento: mantenimiento.fechaMantenimiento,
      },
    );
    return { equipo: actualizado, mantenimiento };
  }

  async listarMantenimientos(id: string): Promise<Mantenimiento[]> {
    await this.obtener(id);
    return this.equipos.listarMantenimientos(id);
  }

  async obtener(id: string): Promise<Equipo> {
    const equipo = await this.equipos.buscarPorId(id);
    if (!equipo) throw new RecursoNoEncontradoError('Equipo');
    return equipo;
  }

  listar(
    filtros: FiltrosEquipos,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<Equipo>> {
    return this.equipos.listar(filtros, paginacion);
  }
}
