import { Injectable } from '@nestjs/common';
import {
  ConflictoNegocioError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type {
  Ciudadano,
  DatosIdentidad,
} from '../../domain/entities/ciudadano.entity.js';
import { CiudadanosRepositorio } from '../../domain/repositories/ciudadanos.repository.js';
import {
  type ArchivosPorLado,
  DocumentosCargados,
} from '../services/documentos_cargados.service.js';
import { ObtenerCiudadano } from './obtener_ciudadano.use-case.js';

export interface ReenviarVerificacionEntrada {
  identidad: Partial<DatosIdentidad>;
  archivos: ArchivosPorLado;
}

/**
 * Respuesta a "requiere corrección": fotos nuevas y, si hace falta, datos de
 * identidad corregidos. Vuelve a `pendiente` para una nueva revisión.
 */
@Injectable()
export class ReenviarVerificacion {
  constructor(
    private readonly obtenerCiudadano: ObtenerCiudadano,
    private readonly ciudadanosRepositorio: CiudadanosRepositorio,
    private readonly documentosCargados: DocumentosCargados,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    { identidad, archivos }: ReenviarVerificacionEntrada,
    contexto: ContextoSolicitud,
  ): Promise<Ciudadano> {
    const ciudadano = await this.obtenerCiudadano.ejecutar(contexto.usuarioId);
    const camposCorregidos = Object.entries(identidad)
      .filter(([, valor]) => valor !== undefined)
      .map(([campo]) => campo);
    if (camposCorregidos.length === 0 && Object.keys(archivos).length === 0) {
      throw new ReglaNegocioError(
        'Envíe al menos una foto nueva o un dato corregido',
      );
    }

    const ahora = new Date();
    const documentoAnterior = ciudadano.numeroDocumento;
    ciudadano.corregirIdentidad(identidad, ahora);
    if (
      ciudadano.numeroDocumento !== documentoAnterior &&
      (await this.ciudadanosRepositorio.existeDocumento(
        ciudadano.numeroDocumento,
        ciudadano.id,
      ))
    ) {
      throw new ConflictoNegocioError(
        'Ya existe una cuenta con ese número de documento',
      );
    }

    const nuevos = await this.documentosCargados.guardar(archivos, ahora);
    try {
      const { cambio, reemplazados } = ciudadano.verificacion.reenviar({
        documentosNuevos: nuevos,
        fecha: ahora,
      });
      const actualizado = await this.ciudadanosRepositorio.registrarReenvio(
        ciudadano,
        { nuevos, reemplazados, cambio },
      );
      await this.auditoria.registrar({
        usuarioId: ciudadano.id,
        entidad: 'verificaciones_identidad',
        entidadId: ciudadano.verificacion.id,
        accion: 'reenviar',
        detalle: {
          camposCorregidos,
          ladosReemplazados: nuevos.map((d) => d.lado),
        },
        direccionIp: contexto.direccionIp,
      });
      return actualizado;
    } catch (error) {
      await this.documentosCargados.descartar(nuevos);
      throw error;
    }
  }
}
