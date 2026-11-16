import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import { AlmacenamientoFirmas } from '../../domain/services/almacenamiento_firmas.js';

export interface ReferenciaImagenFirma {
  claveAlmacenamiento: string;
  huellaSha256: string;
}

/** La imagen no es la que se registró: alguien cambió el archivo. */
export class FirmaAlteradaError extends Error {}

/**
 * Lee y descifra una firma, y comprueba que siga siendo la misma que se
 * registró: si la huella no coincide, no la entrega.
 */
@Injectable()
export class LectorImagenFirma {
  constructor(private readonly almacenamiento: AlmacenamientoFirmas) {}

  async leer(referencia: ReferenciaImagenFirma): Promise<Uint8Array> {
    const contenido = await this.almacenamiento.leer(
      referencia.claveAlmacenamiento,
    );
    if (!contenido) throw new RecursoNoEncontradoError('Imagen de la firma');
    const huella = createHash('sha256').update(contenido).digest('hex');
    if (huella !== referencia.huellaSha256) {
      throw new FirmaAlteradaError(
        `La firma ${referencia.claveAlmacenamiento} no coincide con su huella`,
      );
    }
    return contenido;
  }
}
