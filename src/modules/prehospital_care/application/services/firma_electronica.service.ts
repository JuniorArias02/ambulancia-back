import { Injectable } from '@nestjs/common';
import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import { UsuariosRepositorio } from '../../../users/domain/repositories/usuarios.repository.js';
import { HashContrasena } from '../../../users/domain/services/hash_contrasena.service.js';

export interface DatosFirma {
  /** La contraseña de quien firma, escrita en el momento de firmar. */
  contrasena: string;
  aceptaDeclaracion: boolean;
}

/**
 * Firma electrónica del profesional (Ley 527 de 1999, Decreto 2364 de 2012):
 * no basta con la sesión abierta en el celular de la ambulancia, que pudo
 * quedar en manos de otro. Quien firma vuelve a escribir su contraseña, así
 * el acto queda ligado solo a esa persona.
 */
@Injectable()
export class FirmaElectronicaHistoria {
  constructor(
    private readonly usuariosRepositorio: UsuariosRepositorio,
    private readonly hashContrasena: HashContrasena,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async verificar(
    historiaId: string,
    firma: DatosFirma,
    contexto: ContextoSolicitud,
  ): Promise<void> {
    if (!firma.aceptaDeclaracion) {
      throw new ReglaNegocioError(
        'Para firmar debe aceptar la declaración de veracidad',
      );
    }
    const usuario = contexto.usuarioId
      ? await this.usuariosRepositorio.buscarPorId(contexto.usuarioId)
      : null;
    // Un usuario inexistente o inactivo responde igual que una contraseña errada.
    const valida =
      usuario !== null &&
      usuario.estaActivo() &&
      (await this.hashContrasena.verificar(
        usuario.contrasenaHash,
        firma.contrasena,
      ));
    if (!valida) {
      await this.auditoria.registrar({
        usuarioId: contexto.usuarioId,
        entidad: 'historias_clinicas',
        entidadId: historiaId,
        accion: 'firma_rechazada',
        detalle: { motivo: 'credenciales_invalidas' },
        direccionIp: contexto.direccionIp,
      });
      throw new ReglaNegocioError(
        'La contraseña no es correcta: la historia no se firmó',
      );
    }
  }
}
