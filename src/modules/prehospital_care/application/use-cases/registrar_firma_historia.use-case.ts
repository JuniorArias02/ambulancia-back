import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import { AlmacenamientoFirmas } from '../../../signatures/domain/services/almacenamiento_firmas.js';
import { validarImagenFirma } from '../../../signatures/domain/services/imagen_firma.js';
import {
  crearFirmaHistoria,
  type FirmaHistoria,
  type ImagenFirmaHistoria,
  type MotivoSinFirma,
  type Parentesco,
  type PropositoFirma,
  type RolFirmante,
} from '../../domain/entities/firma_historia.js';
import { HistoriasClinicasRepositorio } from '../../domain/repositories/historias_clinicas.repository.js';
import { AccesoHistoriaClinica } from '../services/acceso_historia_clinica.service.js';

export interface RegistrarFirmaHistoriaEntrada {
  /** Generado en el celular: reenviarlo no duplica. */
  id?: string;
  rolFirmante: RolFirmante;
  proposito: PropositoFirma;
  nombreFirmante?: string;
  tipoDocumento?: string;
  numeroDocumento?: string;
  parentesco?: Parentesco;
  cargo?: string;
  /** PNG dibujado en el celular; no va si hay `motivoSinFirma`. */
  imagen?: Uint8Array;
  motivoSinFirma?: MotivoSinFirma;
  detalleMotivo?: string;
  firmadaEn?: Date;
}

/**
 * Toma la firma del paciente, un familiar, un testigo o quien recibe, en una
 * historia en borrador. La imagen se guarda cifrada, como las firmas de los
 * profesionales; en la base solo queda la referencia y su huella.
 */
@Injectable()
export class RegistrarFirmaHistoria {
  private readonly logger = new Logger(RegistrarFirmaHistoria.name);

  constructor(
    private readonly historiasRepositorio: HistoriasClinicasRepositorio,
    private readonly acceso: AccesoHistoriaClinica,
    private readonly almacenamiento: AlmacenamientoFirmas,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    historiaId: string,
    datos: RegistrarFirmaHistoriaEntrada,
    contexto: ContextoSolicitud,
  ): Promise<FirmaHistoria> {
    const historia = await this.acceso.cargarParaEditar(historiaId, contexto);
    const ahora = new Date();
    const id = datos.id ?? crypto.randomUUID();

    // Un reenvío del celular devuelve la misma, sin guardar otra imagen.
    const reenviada = await this.historiasRepositorio.buscarFirmaHistoria(
      historiaId,
      id,
    );
    if (reenviada) return reenviada;

    const imagen = datos.imagen ? this.describir(datos.imagen) : null;
    // Valida todas las reglas antes de guardar el archivo.
    const nueva = crearFirmaHistoria(
      {
        id,
        historiaClinicaId: historiaId,
        rolFirmante: datos.rolFirmante,
        proposito: datos.proposito,
        nombreFirmante: datos.nombreFirmante,
        tipoDocumento: datos.tipoDocumento,
        numeroDocumento: datos.numeroDocumento,
        parentesco: datos.parentesco,
        cargo: datos.cargo,
        imagen,
        motivoSinFirma: datos.motivoSinFirma,
        detalleMotivo: datos.detalleMotivo,
        firmadaEn: datos.firmadaEn ?? ahora,
        registradaPorId: contexto.usuarioId ?? '',
        ahora,
      },
      historia.datos,
    );

    if (imagen && datos.imagen) {
      await this.almacenamiento.guardar(
        imagen.claveAlmacenamiento,
        datos.imagen,
      );
    }
    let firma: FirmaHistoria;
    try {
      firma = await this.historiasRepositorio.agregarFirmaHistoria(nueva);
    } catch (error) {
      if (imagen) await this.descartar(imagen.claveAlmacenamiento);
      throw error;
    }

    // Sin nombres ni documentos en la auditoría.
    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'historias_clinicas',
      entidadId: historiaId,
      accion: `registrar_firma_${firma.rolFirmante}`,
      detalle: {
        registroId: firma.id,
        proposito: firma.proposito,
        conImagen: firma.imagen !== null,
      },
      direccionIp: contexto.direccionIp,
    });
    return firma;
  }

  private describir(contenido: Uint8Array): ImagenFirmaHistoria {
    const valida = validarImagenFirma(contenido);
    return {
      claveAlmacenamiento: crypto.randomUUID(),
      tipoMime: 'image/png',
      ...valida,
      huellaSha256: createHash('sha256').update(contenido).digest('hex'),
    };
  }

  private async descartar(clave: string): Promise<void> {
    try {
      await this.almacenamiento.eliminar(clave);
    } catch {
      this.logger.error(`No se pudo borrar la firma huérfana ${clave}`);
    }
  }
}
