import { Injectable } from '@nestjs/common';
import { NoAutenticadoError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import type { ValorDetalleAuditoria } from '../../../audit/domain/entities/evento_auditoria.entity.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';

/** Quién opera: toda escritura del inventario exige usuario autenticado. */
export function usuarioDe(contexto: ContextoSolicitud): string {
  if (!contexto.usuarioId) throw new NoAutenticadoError();
  return contexto.usuarioId;
}

/** Deja la traza de las operaciones de inventario (sin datos clínicos). */
@Injectable()
export class AuditoriaInventario {
  constructor(private readonly auditoria: AuditoriaRepositorio) {}

  registrar(
    contexto: ContextoSolicitud,
    entidad: string,
    entidadId: string,
    accion: string,
    detalle?: { [clave: string]: ValorDetalleAuditoria },
  ): Promise<void> {
    return this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad,
      entidadId,
      accion,
      detalle,
      direccionIp: contexto.direccionIp,
    });
  }
}

/** Nombres de los campos que de verdad llegaron (los `undefined` no cuentan). */
export function camposEnviados(cambios: object): string[] {
  return Object.entries(cambios)
    .filter(([, valor]) => valor !== undefined)
    .map(([campo]) => campo);
}
