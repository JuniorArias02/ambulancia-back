import { Injectable } from '@nestjs/common';
import { ConflictoNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import { HashContrasena } from '../../../users/domain/services/hash_contrasena.service.js';
import {
  Ciudadano,
  type DatosIdentidad,
} from '../../domain/entities/ciudadano.entity.js';
import { VerificacionIdentidad } from '../../domain/entities/verificacion_identidad.entity.js';
import { CiudadanosRepositorio } from '../../domain/repositories/ciudadanos.repository.js';
import type { ArchivoCargado } from '../../domain/services/archivo_documento.js';
import { DocumentosCargados } from '../services/documentos_cargados.service.js';

export interface RegistrarCiudadanoEntrada extends DatosIdentidad {
  correo: string;
  telefono: string;
  contrasena: string;
  documentoFrontal: ArchivoCargado;
  documentoPosterior: ArchivoCargado;
  direccionIp: string | null;
}

/** Igual para correo y documento: no confirma cuál de los dos existe. */
const MENSAJE_DUPLICADO =
  'Ya existe una cuenta con ese correo o ese número de documento';

/**
 * Registro público. El rol lo pone el backend, la cuenta nace `pendiente` y
 * no puede reportar emergencias hasta que un administrador la verifique.
 */
@Injectable()
export class RegistrarCiudadano {
  constructor(
    private readonly ciudadanosRepositorio: CiudadanosRepositorio,
    private readonly hashContrasena: HashContrasena,
    private readonly documentosCargados: DocumentosCargados,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(datos: RegistrarCiudadanoEntrada): Promise<Ciudadano> {
    const ahora = new Date();
    const usuarioId = crypto.randomUUID();
    // Valida la identidad antes de tocar el disco o la base de datos.
    const identidad = Ciudadano.validarIdentidad(datos, ahora);
    if (
      (await this.ciudadanosRepositorio.existeCorreo(
        Ciudadano.normalizarCorreo(datos.correo),
      )) ||
      (await this.ciudadanosRepositorio.existeDocumento(
        identidad.numeroDocumento,
      ))
    ) {
      throw new ConflictoNegocioError(MENSAJE_DUPLICADO);
    }

    const documentos = await this.documentosCargados.guardar(
      { frontal: datos.documentoFrontal, posterior: datos.documentoPosterior },
      ahora,
    );
    const { verificacion, cambio } = VerificacionIdentidad.iniciar({
      usuarioId,
      documentos,
      fecha: ahora,
    });
    const ciudadano = Ciudadano.registrar(
      { ...datos, id: usuarioId, verificacion },
      ahora,
    );

    let registrado: Ciudadano;
    try {
      registrado = await this.ciudadanosRepositorio.registrar(
        ciudadano,
        await this.hashContrasena.generar(datos.contrasena),
        cambio,
      );
    } catch (error) {
      await this.documentosCargados.descartar(documentos);
      if (error instanceof ConflictoNegocioError) {
        throw new ConflictoNegocioError(MENSAJE_DUPLICADO);
      }
      throw error;
    }

    // Sin datos personales en la auditoría: el registro ya los tiene.
    await this.auditoria.registrar({
      usuarioId,
      entidad: 'usuarios',
      entidadId: usuarioId,
      accion: 'registrar_ciudadano',
      detalle: { verificacionId: verificacion.id },
      direccionIp: datos.direccionIp,
    });
    return registrado;
  }
}
