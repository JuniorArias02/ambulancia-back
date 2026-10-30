import { Injectable } from '@nestjs/common';
import { NoAutenticadoError } from '../../../../common/exceptions/errores_dominio.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import { Usuario } from '../../../users/domain/entities/usuario.entity.js';
import { UsuariosRepositorio } from '../../../users/domain/repositories/usuarios.repository.js';
import { HashContrasena } from '../../../users/domain/services/hash_contrasena.service.js';
import { Sesion } from '../../domain/entities/sesion.entity.js';
import { SesionesRepositorio } from '../../domain/repositories/sesiones.repository.js';
import { EmisorTokens } from '../../domain/services/emisor_tokens.service.js';

export interface IniciarSesionEntrada {
  correo: string;
  contrasena: string;
  direccionIp: string | null;
}

export interface SesionIniciada {
  tokenAcceso: string;
  expiraEn: Date;
  usuario: Usuario;
}

@Injectable()
export class IniciarSesion {
  private hashFicticio?: Promise<string>;

  constructor(
    private readonly usuariosRepositorio: UsuariosRepositorio,
    private readonly sesionesRepositorio: SesionesRepositorio,
    private readonly hashContrasena: HashContrasena,
    private readonly emisorTokens: EmisorTokens,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(datos: IniciarSesionEntrada): Promise<SesionIniciada> {
    const usuario = await this.usuariosRepositorio.buscarPorCorreo(
      Usuario.normalizarCorreo(datos.correo),
    );

    // Se verifica contra un hash ficticio cuando el correo no existe para que
    // el tiempo de respuesta no revele qué cuentas están registradas.
    const hash = usuario?.contrasenaHash ?? (await this.obtenerHashFicticio());
    const contrasenaValida = await this.hashContrasena.verificar(
      hash,
      datos.contrasena,
    );

    if (!usuario || !contrasenaValida || !usuario.estaActivo()) {
      await this.registrarIntentoFallido(usuario, contrasenaValida, datos);
      throw new NoAutenticadoError();
    }

    const sesionId = crypto.randomUUID();
    const { token, tokenHash, expiraEn } = await this.emisorTokens.emitir({
      usuarioId: usuario.id,
      sesionId,
    });

    await this.sesionesRepositorio.guardar(
      Sesion.crear({
        id: sesionId,
        usuarioId: usuario.id,
        tokenHash,
        expiraEn,
      }),
    );
    await this.usuariosRepositorio.registrarAcceso(usuario.id, new Date());

    await this.auditoria.registrar({
      usuarioId: usuario.id,
      entidad: 'sesiones',
      entidadId: sesionId,
      accion: 'iniciar_sesion',
      direccionIp: datos.direccionIp,
    });

    return { tokenAcceso: token, expiraEn, usuario };
  }

  private obtenerHashFicticio(): Promise<string> {
    this.hashFicticio ??= this.hashContrasena.generar(crypto.randomUUID());
    return this.hashFicticio;
  }

  private async registrarIntentoFallido(
    usuario: Usuario | null,
    contrasenaValida: boolean,
    datos: IniciarSesionEntrada,
  ): Promise<void> {
    let motivo = 'usuario_inexistente';
    if (usuario) {
      motivo = contrasenaValida
        ? `usuario_${usuario.estado}`
        : 'contrasena_invalida';
    }

    await this.auditoria.registrar({
      usuarioId: usuario?.id ?? null,
      entidad: 'usuarios',
      entidadId: usuario?.id ?? 'desconocido',
      accion: 'inicio_sesion_fallido',
      detalle: { motivo },
      direccionIp: datos.direccionIp,
    });
  }
}
