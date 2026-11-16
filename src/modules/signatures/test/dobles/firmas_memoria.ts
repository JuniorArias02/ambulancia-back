import { deflateSync } from 'node:zlib';
import { ConflictoNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import { FirmaUsuario } from '../../domain/entities/firma_usuario.entity.js';
import { FirmasUsuariosRepositorio } from '../../domain/repositories/firmas_usuarios.repository.js';
import { AlmacenamientoFirmas } from '../../domain/services/almacenamiento_firmas.js';

export class FirmasUsuariosMemoria extends FirmasUsuariosRepositorio {
  readonly firmas = new Map<string, FirmaUsuario>();
  /** Para simular que la base de datos falla al registrar. */
  fallarAlRegistrar = false;

  buscarPorId(id: string): Promise<FirmaUsuario | null> {
    const firma = this.firmas.get(id);
    return Promise.resolve(firma ? copia(firma) : null);
  }

  buscarVigente(usuarioId: string): Promise<FirmaUsuario | null> {
    const firma = [...this.firmas.values()].find(
      (f) => f.usuarioId === usuarioId && f.vigente,
    );
    return Promise.resolve(firma ? copia(firma) : null);
  }

  listarDeUsuario(usuarioId: string): Promise<FirmaUsuario[]> {
    return Promise.resolve(
      [...this.firmas.values()]
        .filter((f) => f.usuarioId === usuarioId)
        .sort((a, b) => b.registradaEn.getTime() - a.registradaEn.getTime())
        .map(copia),
    );
  }

  registrar(firma: FirmaUsuario): Promise<FirmaUsuario> {
    if (this.fallarAlRegistrar) {
      return Promise.reject(new Error('La base de datos no respondió'));
    }
    for (const [id, existente] of this.firmas) {
      if (existente.usuarioId === firma.usuarioId && existente.vigente) {
        this.firmas.set(
          id,
          FirmaUsuario.reconstruir({
            ...propiedades(existente),
            vigente: false,
            reemplazadaEn: firma.registradaEn,
          }),
        );
      }
    }
    this.firmas.set(firma.id, copia(firma));
    return Promise.resolve(copia(firma));
  }

  desactivar(firma: FirmaUsuario): Promise<FirmaUsuario> {
    if (!this.firmas.get(firma.id)?.vigente) {
      return Promise.reject(new ConflictoNegocioError('Ya no está vigente'));
    }
    this.firmas.set(firma.id, copia(firma));
    return Promise.resolve(copia(firma));
  }
}

/** Guarda tal cual, en memoria (el cifrado se prueba con el adaptador real). */
export class AlmacenamientoFirmasMemoria extends AlmacenamientoFirmas {
  readonly archivos = new Map<string, Uint8Array>();

  guardar(clave: string, contenido: Uint8Array): Promise<void> {
    this.archivos.set(clave, new Uint8Array(contenido));
    return Promise.resolve();
  }
  leer(clave: string): Promise<Uint8Array | null> {
    return Promise.resolve(this.archivos.get(clave) ?? null);
  }
  eliminar(clave: string): Promise<void> {
    this.archivos.delete(clave);
    return Promise.resolve();
  }
}

function propiedades(f: FirmaUsuario) {
  return {
    id: f.id,
    usuarioId: f.usuarioId,
    claveAlmacenamiento: f.claveAlmacenamiento,
    tipoMime: f.tipoMime,
    tamanoBytes: f.tamanoBytes,
    anchoPx: f.anchoPx,
    altoPx: f.altoPx,
    huellaSha256: f.huellaSha256,
    vigente: f.vigente,
    registradaEn: f.registradaEn,
    reemplazadaEn: f.reemplazadaEn,
    desactivadaEn: f.desactivadaEn,
    desactivadaPorId: f.desactivadaPorId,
    motivoDesactivacion: f.motivoDesactivacion,
  };
}

/** Copia: así una prueba no ve cambios que el caso de uso no guardó. */
function copia(f: FirmaUsuario): FirmaUsuario {
  return FirmaUsuario.reconstruir(propiedades(f));
}

/** Un PNG real y completo (blanco), del tamaño pedido. */
export function crearPngPrueba(ancho = 600, alto = 200): Uint8Array {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 0; // escala de grises
  const fila = Buffer.alloc(1 + ancho, 0xff);
  fila[0] = 0; // sin filtro
  const datos = deflateSync(
    Buffer.concat(Array.from({ length: alto }, () => fila)),
  );
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      fragmento('IHDR', ihdr),
      fragmento('IDAT', datos),
      fragmento('IEND', Buffer.alloc(0)),
    ]),
  );
}

function fragmento(tipo: string, datos: Buffer): Buffer {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

function crc32(datos: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of datos) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
