import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import { LectorImagenFirma } from '../../../signatures/application/services/lector_imagen_firma.service.js';
import { FirmasUsuariosRepositorio } from '../../../signatures/domain/repositories/firmas_usuarios.repository.js';
import { UsuariosRepositorio } from '../../../users/domain/repositories/usuarios.repository.js';
import { DECLARACION_FIRMA_HISTORIA } from '../../domain/declaracion_firma.js';
import { TEXTOS_FIRMA } from '../../domain/entities/firma_historia.js';
import { HistoriasClinicasRepositorio } from '../../domain/repositories/historias_clinicas.repository.js';
import { GeneradorPdfHistoria } from '../../domain/services/generador_pdf_historia.js';
import {
  AccesoHistoriaClinica,
  type Solicitante,
} from '../services/acceso_historia_clinica.service.js';

export interface HistoriaPdf {
  nombreArchivo: string;
  contenido: Uint8Array;
}

/**
 * El PDF de la historia con todas sus firmas (profesional, paciente o
 * familiar, testigo, receptor). Para la tripulación clínica y el
 * administrador; queda auditado. En borrador o anulada, el PDF lo dice.
 */
@Injectable()
export class ExportarHistoriaPdf {
  constructor(
    private readonly historiasRepositorio: HistoriasClinicasRepositorio,
    private readonly acceso: AccesoHistoriaClinica,
    private readonly firmasUsuarios: FirmasUsuariosRepositorio,
    private readonly lector: LectorImagenFirma,
    private readonly usuariosRepositorio: UsuariosRepositorio,
    private readonly generador: GeneradorPdfHistoria,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    historiaId: string,
    solicitante: Solicitante,
    contexto: ContextoSolicitud,
  ): Promise<HistoriaPdf> {
    const detalle = await this.historiasRepositorio.buscarDetalle(historiaId);
    if (!detalle) throw new RecursoNoEncontradoError('Historia clínica');
    const { historia } = detalle;
    await this.acceso.exigirLectura(historia, solicitante);

    const firmaCierre = historia.firmaCierre
      ? await this.firmasUsuarios.buscarPorId(historia.firmaCierre.id)
      : null;
    const quienGenera = contexto.usuarioId
      ? await this.usuariosRepositorio.buscarPorId(contexto.usuarioId)
      : null;

    const contenido = await this.generador.generar({
      detalle,
      firmaProfesional:
        historia.estado === 'cerrada' || historia.cerradaEn
          ? {
              nombre: historia.cerradaPorNombre,
              firmadaEn: historia.cerradaEn ?? new Date(),
              codigoVerificacion: (historia.hashCierre ?? '')
                .slice(0, 12)
                .toUpperCase(),
              imagen: firmaCierre ? await this.lector.leer(firmaCierre) : null,
            }
          : null,
      firmas: await Promise.all(
        detalle.firmasHistoria.map(async (firma) => ({
          firma,
          imagen: firma.imagen ? await this.lector.leer(firma.imagen) : null,
        })),
      ),
      textosFirma: Object.fromEntries(
        Object.entries(TEXTOS_FIRMA).map(([proposito, t]) => [
          proposito,
          t.texto,
        ]),
      ),
      declaracionProfesional: DECLARACION_FIRMA_HISTORIA.texto,
      generadoEn: new Date(),
      generadoPor: quienGenera
        ? `${quienGenera.nombres} ${quienGenera.apellidos}`
        : null,
    });

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'historias_clinicas',
      entidadId: historiaId,
      accion: 'exportar_pdf',
      detalle: { numeroHistoria: historia.numeroHistoria },
      direccionIp: contexto.direccionIp,
    });
    return { nombreArchivo: `${historia.numeroHistoria}.pdf`, contenido };
  }
}
