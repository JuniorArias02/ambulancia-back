import type { FirmaHistoria } from '../entities/firma_historia.js';
import type { DetalleHistoria } from '../repositories/historias_clinicas.repository.js';

/** Todo lo que va en el PDF; las imágenes de las firmas ya descifradas. */
export interface DocumentoHistoriaPdf {
  detalle: DetalleHistoria;
  firmaProfesional: {
    nombre: string | null;
    firmadaEn: Date;
    codigoVerificacion: string;
    imagen: Uint8Array | null;
  } | null;
  firmas: { firma: FirmaHistoria; imagen: Uint8Array | null }[];
  /** Textos aceptados por propósito, para imprimirlos junto a la firma. */
  textosFirma: Readonly<Record<string, string>>;
  declaracionProfesional: string;
  generadoEn: Date;
  generadoPor: string | null;
}

/** Arma el PDF de una historia clínica. */
export abstract class GeneradorPdfHistoria {
  abstract generar(documento: DocumentoHistoriaPdf): Promise<Uint8Array>;
}
