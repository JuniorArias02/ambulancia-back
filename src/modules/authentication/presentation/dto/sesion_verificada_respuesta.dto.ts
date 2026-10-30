import type { NombreRol } from '../../../../common/constants/roles.js';
import type { SesionVerificada } from '../../application/use-cases/verificar_sesion_token.use-case.js';

/** Solo lo que el servidor de tiempo real necesita para asignar salas y vigilar la conexión. */
export class SesionVerificadaRespuestaDto {
  usuarioId: string;
  rol: NombreRol;
  expiraEn: Date;

  static desde({
    usuario,
    expiraEn,
  }: SesionVerificada): SesionVerificadaRespuestaDto {
    return { usuarioId: usuario.id, rol: usuario.rol, expiraEn };
  }
}
