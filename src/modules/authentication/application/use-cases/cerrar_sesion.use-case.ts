import { Injectable } from '@nestjs/common';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import { SesionesRepositorio } from '../../domain/repositories/sesiones.repository.js';

@Injectable()
export class CerrarSesion {
  constructor(
    private readonly sesionesRepositorio: SesionesRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(sesionId: string, contexto: ContextoSolicitud): Promise<void> {
    await this.sesionesRepositorio.revocar(sesionId, new Date());

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'sesiones',
      entidadId: sesionId,
      accion: 'cerrar_sesion',
      direccionIp: contexto.direccionIp,
    });
  }
}
