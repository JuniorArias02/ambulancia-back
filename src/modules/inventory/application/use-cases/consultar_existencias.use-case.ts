import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import { fechaColombia } from '../../../../common/utils/fecha_colombia.js';
import { AmbulanciasRepositorio } from '../../../ambulances/domain/repositories/ambulancias.repository.js';
import type { Existencia } from '../../domain/entities/existencia.js';
import type { PerfilDotacion } from '../../domain/entities/perfil_dotacion.entity.js';
import type { UbicacionInventario } from '../../domain/entities/ubicacion_inventario.entity.js';
import {
  ExistenciasRepositorio,
  type FiltrosExistencias,
} from '../../domain/repositories/existencias.repository.js';
import { PerfilesDotacionRepositorio } from '../../domain/repositories/perfiles_dotacion.repository.js';
import { UbicacionesInventarioRepositorio } from '../../domain/repositories/ubicaciones_inventario.repository.js';
import {
  type ComparacionDotacion,
  compararDotacion,
} from '../../domain/services/comparacion_dotacion.js';

export interface DotacionAmbulancia {
  ambulanciaId: string;
  ambulanciaCodigo: string;
  /** `null` si la ambulancia aún no está habilitada en el inventario. */
  ubicacion: UbicacionInventario | null;
  /** El perfil que rige hoy para su tipo; `null` si no hay uno vigente. */
  perfil: PerfilDotacion | null;
  existencias: Existencia[];
  comparacion: ComparacionDotacion;
  /** Día de Colombia con el que se evaluaron los vencimientos. */
  fecha: string;
}

@Injectable()
export class ConsultarExistencias {
  constructor(
    private readonly existencias: ExistenciasRepositorio,
    private readonly ubicaciones: UbicacionesInventarioRepositorio,
    private readonly perfiles: PerfilesDotacionRepositorio,
    private readonly ambulancias: AmbulanciasRepositorio,
  ) {}

  listar(
    filtros: FiltrosExistencias,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<Existencia>> {
    return this.existencias.listar(filtros, paginacion);
  }

  /** Lo que hay en la ambulancia frente a lo que su perfil de dotación exige. */
  async dotacionDeAmbulancia(
    ambulanciaId: string,
    ahora: Date = new Date(),
  ): Promise<DotacionAmbulancia> {
    const ambulancia = await this.ambulancias.buscarPorId(ambulanciaId);
    if (!ambulancia) throw new RecursoNoEncontradoError('Ambulancia');
    const fecha = fechaColombia(ahora);
    const [ubicacion, perfil] = await Promise.all([
      this.ubicaciones.buscarDeAmbulancia(ambulanciaId),
      this.perfilVigente(ambulancia.tipo.id, fecha),
    ]);
    const existencias = ubicacion
      ? await this.existencias.deUbicacion(ubicacion.id)
      : [];
    return {
      ambulanciaId,
      ambulanciaCodigo: ambulancia.codigo,
      ubicacion,
      perfil,
      existencias,
      comparacion: compararDotacion(perfil, existencias, fecha),
      fecha,
    };
  }

  async perfilVigente(
    tipoAmbulanciaId: string,
    hoy: string,
  ): Promise<PerfilDotacion | null> {
    const perfil = await this.perfiles.buscarActivoDeTipo(tipoAmbulanciaId);
    return perfil?.vigenteEn(hoy) ? perfil : null;
  }
}
