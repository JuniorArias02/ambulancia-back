import { Injectable } from '@nestjs/common';
import { fechaColombia } from '../../../../common/utils/fecha_colombia.js';
import {
  type AlertasInventario,
  AlertasInventarioRepositorio,
} from '../../domain/repositories/alertas_inventario.repository.js';

export const DIAS_ALERTA_PREDETERMINADOS = 30;

export interface AlertasConFecha extends AlertasInventario {
  /** Hasta qué día se buscaron vencimientos y mantenimientos. */
  hasta: string;
}

@Injectable()
export class ConsultarAlertasInventario {
  constructor(private readonly alertas: AlertasInventarioRepositorio) {}

  async ejecutar(
    dias: number = DIAS_ALERTA_PREDETERMINADOS,
    ahora: Date = new Date(),
  ): Promise<AlertasConFecha> {
    const hasta = fechaColombia(
      new Date(ahora.getTime() + dias * 24 * 60 * 60 * 1000),
    );
    return { ...(await this.alertas.obtener(hasta)), hasta };
  }
}
