import { Injectable } from '@nestjs/common';
import {
  RecursoNoEncontradoError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import { FirmasUsuariosRepositorio } from '../../../signatures/domain/repositories/firmas_usuarios.repository.js';
import type { FirmaCierreHistoria } from '../../domain/entities/historia_clinica.entity.js';
import { resumirFirma } from '../../domain/entities/firma_historia.js';
import {
  type DetalleHistoria,
  HistoriasClinicasRepositorio,
} from '../../domain/repositories/historias_clinicas.repository.js';
import {
  DECLARACION_FIRMA_HISTORIA,
  METODO_FIRMA_HISTORIA,
} from '../../domain/declaracion_firma.js';
import { AccesoHistoriaClinica } from '../services/acceso_historia_clinica.service.js';
import {
  type DatosFirma,
  FirmaElectronicaHistoria,
} from '../services/firma_electronica.service.js';
import { PoliticaFirmaCierre } from '../services/politica_firma_cierre.js';
import { HuellaHistoria } from '../services/huella_historia.service.js';

/**
 * Firma electrónica y cierre: comprueba la identidad de quien firma, valida
 * que esté completa, la sella con la huella y desde ahí ya no se edita.
 * La firma son la identidad comprobada + la fecha + la firma registrada del
 * profesional (la versión exacta que se estampó) + la huella del contenido
 * (Resolución 1995 de 1999, art. 5 y 18; Ley 527 de 1999).
 */
@Injectable()
export class CerrarHistoriaClinica {
  constructor(
    private readonly historiasRepositorio: HistoriasClinicasRepositorio,
    private readonly acceso: AccesoHistoriaClinica,
    private readonly huella: HuellaHistoria,
    private readonly firma: FirmaElectronicaHistoria,
    private readonly firmasRepositorio: FirmasUsuariosRepositorio,
    private readonly politica: PoliticaFirmaCierre,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    historiaId: string,
    firma: DatosFirma,
    contexto: ContextoSolicitud,
  ): Promise<DetalleHistoria> {
    await this.acceso.cargarParaEditar(historiaId, contexto);
    await this.firma.verificar(historiaId, firma, contexto);
    const firmaCierre = await this.firmaRegistrada(contexto.usuarioId);
    const detalle = await this.historiasRepositorio.buscarDetalle(historiaId);
    if (!detalle) throw new RecursoNoEncontradoError('Historia clínica');

    const { historia } = detalle;
    historia.cerrar({
      cerradaPorId: contexto.usuarioId ?? '',
      fecha: new Date(),
      firmaCierre,
      calcularHuella: (completa) =>
        this.huella.calcular({ ...detalle, historia: completa }, firmaCierre),
      registros: {
        signosVitales: detalle.signosVitales.length,
        // En la transición (FIRMA_CIERRE_OBLIGATORIA=false) no se exigen firmas.
        firmas: this.politica.exigeFirmaRegistrada
          ? detalle.firmasHistoria.map(resumirFirma)
          : null,
      },
    });
    const cerrada = await this.historiasRepositorio.actualizar(
      historia,
      'borrador',
    );

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'historias_clinicas',
      entidadId: historia.id,
      accion: 'cerrar',
      detalle: {
        numeroHistoria: historia.numeroHistoria,
        hashCierre: cerrada.hashCierre,
        metodoFirma: METODO_FIRMA_HISTORIA,
        versionDeclaracion: DECLARACION_FIRMA_HISTORIA.version,
        firmaCierreId: firmaCierre?.id ?? null,
      },
      direccionIp: contexto.direccionIp,
    });
    return { ...detalle, historia: cerrada };
  }

  /** La firma vigente de quien cierra; sin ella no se cierra, salvo en la transición. */
  private async firmaRegistrada(
    usuarioId: string | null,
  ): Promise<FirmaCierreHistoria | null> {
    const vigente = usuarioId
      ? await this.firmasRepositorio.buscarVigente(usuarioId)
      : null;
    if (!vigente) {
      if (this.politica.exigeFirmaRegistrada) {
        throw new ReglaNegocioError(
          'Registre su firma en "Mi firma" antes de firmar historias clínicas',
        );
      }
      return null;
    }
    return {
      id: vigente.id,
      huellaSha256: vigente.huellaSha256,
      registradaEn: vigente.registradaEn,
    };
  }
}
