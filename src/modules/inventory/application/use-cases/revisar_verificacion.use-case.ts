import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import type { Verificacion } from '../../domain/entities/verificacion.entity.js';
import { VerificacionesRepositorio } from '../../domain/repositories/verificaciones.repository.js';
import {
  AuditoriaInventario,
  usuarioDe,
} from '../services/auditoria_inventario.service.js';

/**
 * La central marca como atendidas las novedades de una verificación y deja
 * constancia de cómo las resolvió. Cierra el ciclo detectar → corregir →
 * demostrar; la corrección en sí (ajuste, baja, reposición) son movimientos.
 */
@Injectable()
export class RevisarVerificacion {
  constructor(
    private readonly verificaciones: VerificacionesRepositorio,
    private readonly auditoria: AuditoriaInventario,
  ) {}

  async ejecutar(
    id: string,
    resolucion: string,
    contexto: ContextoSolicitud,
    ahora: Date = new Date(),
  ): Promise<Verificacion> {
    const usuarioId = usuarioDe(contexto);
    const verificacion = await this.verificaciones.buscarPorId(id);
    if (!verificacion) throw new RecursoNoEncontradoError('Verificación');

    verificacion.revisar(usuarioId, resolucion, ahora);
    const revisada = await this.verificaciones.revisar(verificacion);

    await this.auditoria.registrar(
      contexto,
      'inv_verificaciones',
      id,
      'revisar',
      {
        novedades: revisada.conteos.filter((c) => c.estado !== 'conforme')
          .length,
        resolucion: revisada.revision?.resolucion ?? null,
      },
    );
    return revisada;
  }
}
