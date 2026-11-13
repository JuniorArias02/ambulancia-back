import { Injectable } from '@nestjs/common';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import {
  type ControlAlmacenamiento,
  registrarControlAlmacenamiento,
} from '../../domain/entities/control_almacenamiento.entity.js';
import {
  ControlesAlmacenamientoRepositorio,
  type FiltrosControlesAlmacenamiento,
} from '../../domain/repositories/controles_almacenamiento.repository.js';
import {
  AuditoriaInventario,
  usuarioDe,
} from '../services/auditoria_inventario.service.js';
import { ReferenciasInventario } from '../services/referencias_inventario.service.js';

export interface RegistrarControlEntrada {
  ubicacionId: string;
  temperatura: number | null;
  humedad: number | null;
  registradoEn: Date | null;
  observaciones: string | null;
}

@Injectable()
export class RegistrarControlAlmacenamiento {
  constructor(
    private readonly controles: ControlesAlmacenamientoRepositorio,
    private readonly referencias: ReferenciasInventario,
    private readonly auditoria: AuditoriaInventario,
  ) {}

  async registrar(
    datos: RegistrarControlEntrada,
    contexto: ContextoSolicitud,
  ): Promise<ControlAlmacenamiento> {
    const usuarioId = usuarioDe(contexto);
    const ubicacion = await this.referencias.ubicacion(datos.ubicacionId);
    ubicacion.exigirActiva();
    const control = await this.controles.registrar(
      registrarControlAlmacenamiento({ ...datos, usuarioId }, new Date()),
    );
    await this.auditoria.registrar(
      contexto,
      'inv_controles_almacenamiento',
      control.id,
      'crear',
      { ubicacionId: ubicacion.id },
    );
    return control;
  }

  listar(
    filtros: FiltrosControlesAlmacenamiento,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<ControlAlmacenamiento>> {
    return this.controles.listar(filtros, paginacion);
  }
}
