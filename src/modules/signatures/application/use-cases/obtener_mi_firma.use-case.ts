import { Injectable } from '@nestjs/common';
import { NoAutenticadoError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import type { FirmaUsuario } from '../../domain/entities/firma_usuario.entity.js';
import { FirmasUsuariosRepositorio } from '../../domain/repositories/firmas_usuarios.repository.js';

/** Los datos de la firma vigente del usuario; `null` si no tiene. */
@Injectable()
export class ObtenerMiFirma {
  constructor(private readonly firmasRepositorio: FirmasUsuariosRepositorio) {}

  ejecutar(contexto: ContextoSolicitud): Promise<FirmaUsuario | null> {
    if (!contexto.usuarioId) throw new NoAutenticadoError();
    return this.firmasRepositorio.buscarVigente(contexto.usuarioId);
  }
}
