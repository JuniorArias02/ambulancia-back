import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { AlmacenamientoDocumentos } from '../../domain/services/almacenamiento_documentos.js';

/** Claves generadas por el backend: así ninguna ruta sale de lo que envió el cliente. */
const PATRON_CLAVE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Carpeta privada en el disco del servidor, fuera de lo que sirve la API.
 * Solo el usuario del proceso puede leerla (0700 / 0600).
 */
@Injectable()
export class AlmacenamientoSistemaArchivos extends AlmacenamientoDocumentos {
  private readonly carpeta: string;

  constructor(rutaBase: string) {
    super();
    this.carpeta = resolve(rutaBase, 'documentos_identidad');
  }

  async guardar(clave: string, contenido: Uint8Array): Promise<void> {
    await mkdir(this.carpeta, { recursive: true, mode: 0o700 });
    // `wx`: nunca sobrescribe un archivo existente.
    await writeFile(this.ruta(clave), contenido, { flag: 'wx', mode: 0o600 });
  }

  async leer(clave: string): Promise<Uint8Array | null> {
    try {
      return await readFile(this.ruta(clave));
    } catch (error) {
      if (esArchivoInexistente(error)) return null;
      throw error;
    }
  }

  async eliminar(clave: string): Promise<void> {
    await rm(this.ruta(clave), { force: true });
  }

  private ruta(clave: string): string {
    if (!PATRON_CLAVE.test(clave)) {
      throw new Error('Clave de almacenamiento inválida');
    }
    return join(this.carpeta, clave);
  }
}

function esArchivoInexistente(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
