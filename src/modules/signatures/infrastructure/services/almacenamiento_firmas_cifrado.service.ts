import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ServicioNoDisponibleError } from '../../../../common/exceptions/errores_dominio.js';
import { AlmacenamientoFirmas } from '../../domain/services/almacenamiento_firmas.js';

export interface ClavesCifradoFirmas {
  /** Con esta se cifran las firmas nuevas. */
  versionActual: number;
  /** Todas las que se pueden usar para leer: la actual y las anteriores. */
  claves: ReadonlyMap<number, Buffer>;
}

/** Claves generadas por el backend: así ninguna ruta sale de lo que envió el cliente. */
const PATRON_CLAVE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Formato del archivo:
 * `"GF"` (2) · versión del formato (1) · versión de la clave (1) · IV (12) · etiqueta GCM (16) · contenido cifrado.
 */
const MARCA = Buffer.from('GF', 'ascii');
const VERSION_FORMATO = 1;
const LARGO_IV = 12;
const LARGO_ETIQUETA = 16;
const LARGO_CABECERA = MARCA.length + 2 + LARGO_IV + LARGO_ETIQUETA;

/**
 * Firmas cifradas con AES-256-GCM en una carpeta privada del servidor
 * (0700 / 0600), fuera de lo que sirve la API. La clave interna del archivo
 * va como dato autenticado: un archivo copiado encima de otro no se descifra.
 */
export class AlmacenamientoFirmasCifrado extends AlmacenamientoFirmas {
  private readonly carpeta: string;

  constructor(
    rutaBase: string,
    private readonly claves: ClavesCifradoFirmas | null,
  ) {
    super();
    this.carpeta = resolve(rutaBase, 'firmas');
  }

  async guardar(clave: string, contenido: Uint8Array): Promise<void> {
    const { versionActual, claves } = this.exigirClaves();
    const llave = claves.get(versionActual);
    if (!llave) throw new Error('No está la clave de la versión actual');
    const iv = randomBytes(LARGO_IV);
    const cifrador = createCipheriv('aes-256-gcm', llave, iv);
    cifrador.setAAD(Buffer.from(clave, 'utf8'));
    const cifrado = Buffer.concat([
      cifrador.update(contenido),
      cifrador.final(),
    ]);
    const archivo = Buffer.concat([
      MARCA,
      Buffer.from([VERSION_FORMATO, versionActual]),
      iv,
      cifrador.getAuthTag(),
      cifrado,
    ]);
    await mkdir(this.carpeta, { recursive: true, mode: 0o700 });
    // `wx`: nunca sobrescribe un archivo existente.
    await writeFile(this.ruta(clave), archivo, { flag: 'wx', mode: 0o600 });
  }

  async leer(clave: string): Promise<Uint8Array | null> {
    const { claves } = this.exigirClaves();
    let archivo: Buffer;
    try {
      archivo = await readFile(this.ruta(clave));
    } catch (error) {
      if (esArchivoInexistente(error)) return null;
      throw error;
    }
    if (
      archivo.length <= LARGO_CABECERA ||
      !archivo.subarray(0, MARCA.length).equals(MARCA) ||
      archivo[2] !== VERSION_FORMATO
    ) {
      throw new Error(`Archivo de firma con formato desconocido: ${clave}`);
    }
    const versionClave = archivo[3] ?? 0;
    const llave = claves.get(versionClave);
    if (!llave) {
      throw new ServicioNoDisponibleError(
        `Falta la clave de cifrado de firmas versión ${versionClave} (FIRMAS_CLAVES_ANTERIORES)`,
      );
    }
    const inicioEtiqueta = MARCA.length + 2 + LARGO_IV;
    const descifrador = createDecipheriv(
      'aes-256-gcm',
      llave,
      archivo.subarray(MARCA.length + 2, inicioEtiqueta),
    );
    descifrador.setAAD(Buffer.from(clave, 'utf8'));
    descifrador.setAuthTag(archivo.subarray(inicioEtiqueta, LARGO_CABECERA));
    // Si el archivo o la etiqueta se alteraron, `final()` lanza un error.
    return Buffer.concat([
      descifrador.update(archivo.subarray(LARGO_CABECERA)),
      descifrador.final(),
    ]);
  }

  async eliminar(clave: string): Promise<void> {
    await rm(this.ruta(clave), { force: true });
  }

  private exigirClaves(): ClavesCifradoFirmas {
    if (!this.claves) {
      throw new ServicioNoDisponibleError(
        'El almacenamiento de firmas no está configurado (FIRMAS_CLAVE_CIFRADO)',
      );
    }
    return this.claves;
  }

  private ruta(clave: string): string {
    if (!PATRON_CLAVE.test(clave)) {
      throw new Error('Clave de almacenamiento inválida');
    }
    return join(this.carpeta, clave);
  }
}

/** Arma las claves desde el `.env`; `null` si no hay clave configurada. */
export function clavesDesdeEntorno(variables: {
  clave?: string;
  version?: number;
  anteriores?: string;
}): ClavesCifradoFirmas | null {
  if (!variables.clave) return null;
  const versionActual = variables.version ?? 1;
  const claves = new Map<number, Buffer>();
  for (const par of (variables.anteriores ?? '').split(',').filter(Boolean)) {
    const [version, valor] = par.split(':');
    claves.set(Number(version), Buffer.from(valor ?? '', 'base64'));
  }
  claves.set(versionActual, Buffer.from(variables.clave, 'base64'));
  for (const [version, llave] of claves) {
    if (llave.length !== 32) {
      throw new Error(
        `La clave de firmas versión ${version} no tiene 32 bytes`,
      );
    }
  }
  return { versionActual, claves };
}

function esArchivoInexistente(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
