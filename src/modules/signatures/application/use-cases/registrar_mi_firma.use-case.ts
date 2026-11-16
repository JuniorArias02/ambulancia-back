import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  NoAutenticadoError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import { UsuariosRepositorio } from '../../../users/domain/repositories/usuarios.repository.js';
import { HashContrasena } from '../../../users/domain/services/hash_contrasena.service.js';
import { FirmaUsuario } from '../../domain/entities/firma_usuario.entity.js';
import { FirmasUsuariosRepositorio } from '../../domain/repositories/firmas_usuarios.repository.js';
import { AlmacenamientoFirmas } from '../../domain/services/almacenamiento_firmas.js';
import { validarImagenFirma } from '../../domain/services/imagen_firma.js';

export interface RegistrarMiFirmaEntrada {
  imagen: Uint8Array;
  /** La contraseña del profesional, escrita en el momento. No se guarda. */
  contrasena: string;
}

/**
 * El profesional registra su propia firma: dibujo más contraseña. Solo el
 * dueño la registra; si ya tenía una, la anterior queda como reemplazada.
 */
@Injectable()
export class RegistrarMiFirma {
  private readonly logger = new Logger(RegistrarMiFirma.name);

  constructor(
    private readonly firmasRepositorio: FirmasUsuariosRepositorio,
    private readonly almacenamiento: AlmacenamientoFirmas,
    private readonly usuariosRepositorio: UsuariosRepositorio,
    private readonly hashContrasena: HashContrasena,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    datos: RegistrarMiFirmaEntrada,
    contexto: ContextoSolicitud,
  ): Promise<FirmaUsuario> {
    if (!contexto.usuarioId) throw new NoAutenticadoError();
    const usuarioId = contexto.usuarioId;
    const usuario = await this.usuariosRepositorio.buscarPorId(usuarioId);
    const valida =
      usuario !== null &&
      usuario.estaActivo() &&
      (await this.hashContrasena.verificar(
        usuario.contrasenaHash,
        datos.contrasena,
      ));
    if (!valida) {
      await this.auditar('registrar_rechazada', usuarioId, contexto, {
        motivo: 'credenciales_invalidas',
      });
      throw new ReglaNegocioError(
        'La contraseña no es correcta: la firma no se registró',
      );
    }

    const imagen = validarImagenFirma(datos.imagen);
    const clave = crypto.randomUUID();
    await this.almacenamiento.guardar(clave, datos.imagen);
    let firma: FirmaUsuario;
    try {
      firma = await this.firmasRepositorio.registrar(
        FirmaUsuario.registrar({
          usuarioId,
          claveAlmacenamiento: clave,
          imagen,
          huellaSha256: createHash('sha256').update(datos.imagen).digest('hex'),
          fecha: new Date(),
        }),
      );
    } catch (error) {
      await this.descartar(clave);
      throw error;
    }

    await this.auditar('registrar', firma.id, contexto, {
      usuarioFirmanteId: usuarioId,
    });
    return firma;
  }

  /** Si la base de datos falla, el archivo no puede quedar huérfano. */
  private async descartar(clave: string): Promise<void> {
    try {
      await this.almacenamiento.eliminar(clave);
    } catch {
      this.logger.error(`No se pudo borrar la firma huérfana ${clave}`);
    }
  }

  private auditar(
    accion: string,
    entidadId: string,
    contexto: ContextoSolicitud,
    detalle: Record<string, string>,
  ): Promise<void> {
    return this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'firmas_usuarios',
      entidadId,
      accion,
      detalle,
      direccionIp: contexto.direccionIp,
    });
  }
}
