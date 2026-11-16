import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type { ImagenFirmaValida } from '../services/imagen_firma.js';

export type EstadoFirma = 'vigente' | 'reemplazada' | 'desactivada';

export interface PropiedadesFirmaUsuario {
  id: string;
  usuarioId: string;
  claveAlmacenamiento: string;
  tipoMime: 'image/png';
  tamanoBytes: number;
  anchoPx: number;
  altoPx: number;
  huellaSha256: string;
  vigente: boolean;
  registradaEn: Date;
  reemplazadaEn: Date | null;
  desactivadaEn: Date | null;
  desactivadaPorId: string | null;
  motivoDesactivacion: string | null;
}

/**
 * Firma registrada de un profesional. La registra él mismo con su contraseña
 * y se estampa en las historias que firma. Nunca se sobrescribe: registrar
 * otra deja esta como reemplazada, y las historias conservan la versión que
 * usaron.
 */
export class FirmaUsuario {
  private constructor(private readonly propiedades: PropiedadesFirmaUsuario) {}

  static registrar(datos: {
    usuarioId: string;
    claveAlmacenamiento: string;
    imagen: ImagenFirmaValida;
    huellaSha256: string;
    fecha: Date;
  }): FirmaUsuario {
    return new FirmaUsuario({
      id: crypto.randomUUID(),
      usuarioId: datos.usuarioId,
      claveAlmacenamiento: datos.claveAlmacenamiento,
      tipoMime: 'image/png',
      tamanoBytes: datos.imagen.tamanoBytes,
      anchoPx: datos.imagen.anchoPx,
      altoPx: datos.imagen.altoPx,
      huellaSha256: datos.huellaSha256,
      vigente: true,
      registradaEn: datos.fecha,
      reemplazadaEn: null,
      desactivadaEn: null,
      desactivadaPorId: null,
      motivoDesactivacion: null,
    });
  }

  static reconstruir(propiedades: PropiedadesFirmaUsuario): FirmaUsuario {
    return new FirmaUsuario({ ...propiedades });
  }

  get id(): string {
    return this.propiedades.id;
  }
  get usuarioId(): string {
    return this.propiedades.usuarioId;
  }
  get claveAlmacenamiento(): string {
    return this.propiedades.claveAlmacenamiento;
  }
  get tipoMime(): 'image/png' {
    return this.propiedades.tipoMime;
  }
  get tamanoBytes(): number {
    return this.propiedades.tamanoBytes;
  }
  get anchoPx(): number {
    return this.propiedades.anchoPx;
  }
  get altoPx(): number {
    return this.propiedades.altoPx;
  }
  get huellaSha256(): string {
    return this.propiedades.huellaSha256;
  }
  get vigente(): boolean {
    return this.propiedades.vigente;
  }
  get registradaEn(): Date {
    return this.propiedades.registradaEn;
  }
  get reemplazadaEn(): Date | null {
    return this.propiedades.reemplazadaEn;
  }
  get desactivadaEn(): Date | null {
    return this.propiedades.desactivadaEn;
  }
  get desactivadaPorId(): string | null {
    return this.propiedades.desactivadaPorId;
  }
  get motivoDesactivacion(): string | null {
    return this.propiedades.motivoDesactivacion;
  }

  get estado(): EstadoFirma {
    if (this.propiedades.vigente) return 'vigente';
    return this.propiedades.desactivadaEn ? 'desactivada' : 'reemplazada';
  }

  /**
   * El administrador la desactiva (por ejemplo, si se registró mal o el
   * profesional ya no trabaja aquí). No la puede reemplazar: solo el dueño
   * registra su firma.
   */
  desactivar(datos: { porId: string; motivo: string; fecha: Date }): void {
    if (!this.propiedades.vigente) {
      throw new ReglaNegocioError('La firma ya no está vigente');
    }
    const motivo = datos.motivo.trim();
    if (motivo.length < 5) {
      throw new ReglaNegocioError(
        'Indique el motivo de la desactivación (mínimo 5 caracteres)',
      );
    }
    this.propiedades.vigente = false;
    this.propiedades.desactivadaEn = datos.fecha;
    this.propiedades.desactivadaPorId = datos.porId;
    this.propiedades.motivoDesactivacion = motivo;
  }
}
