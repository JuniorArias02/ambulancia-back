import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ServicioNoDisponibleError } from '../../../../common/exceptions/errores_dominio.js';
import {
  AlmacenamientoFirmasCifrado,
  clavesDesdeEntorno,
} from '../../infrastructure/services/almacenamiento_firmas_cifrado.service.js';
import { crearPngPrueba } from '../dobles/firmas_memoria.js';

const claveBase64 = () => randomBytes(32).toString('base64');

describe('AlmacenamientoFirmasCifrado', () => {
  let carpeta: string;
  const png = crearPngPrueba();

  beforeEach(async () => {
    carpeta = await mkdtemp(join(tmpdir(), 'firmas-'));
  });
  afterEach(async () => {
    await rm(carpeta, { recursive: true, force: true });
  });

  function almacenamiento(
    clave = claveBase64(),
    version = 1,
    anteriores?: string,
  ) {
    return new AlmacenamientoFirmasCifrado(
      carpeta,
      clavesDesdeEntorno({ clave, version, anteriores }),
    );
  }

  it('guarda cifrado en disco y devuelve el contenido original al leer', async () => {
    const a = almacenamiento();
    const clave = crypto.randomUUID();
    await a.guardar(clave, png);

    const enDisco = await readFile(join(carpeta, 'firmas', clave));
    expect(enDisco.subarray(0, 2).toString('ascii')).toBe('GF');
    // El PNG no aparece en claro dentro del archivo.
    expect(enDisco.includes(Buffer.from('IHDR'))).toBe(false);
    expect(Buffer.from((await a.leer(clave)) ?? [])).toEqual(Buffer.from(png));
  });

  it('un archivo alterado no se descifra', async () => {
    const a = almacenamiento();
    const clave = crypto.randomUUID();
    await a.guardar(clave, png);
    const ruta = join(carpeta, 'firmas', clave);
    const enDisco = await readFile(ruta);
    enDisco[enDisco.length - 1] = (enDisco[enDisco.length - 1] ?? 0) ^ 0xff;
    await writeFile(ruta, enDisco);

    await expect(a.leer(clave)).rejects.toThrow();
  });

  it('copiar el archivo de una firma encima de otra no sirve (la clave interna va autenticada)', async () => {
    const a = almacenamiento();
    const original = crypto.randomUUID();
    const otra = crypto.randomUUID();
    await a.guardar(original, png);
    await writeFile(
      join(carpeta, 'firmas', otra),
      await readFile(join(carpeta, 'firmas', original)),
    );

    await expect(a.leer(otra)).rejects.toThrow();
  });

  it('después de rotar la clave sigue leyendo las firmas viejas', async () => {
    const vieja = claveBase64();
    const clave = crypto.randomUUID();
    await almacenamiento(vieja, 1).guardar(clave, png);

    const rotado = almacenamiento(claveBase64(), 2, `1:${vieja}`);
    expect(Buffer.from((await rotado.leer(clave)) ?? [])).toEqual(
      Buffer.from(png),
    );
    await expect(almacenamiento(claveBase64(), 2).leer(clave)).rejects.toThrow(
      ServicioNoDisponibleError,
    );
  });

  it('sin clave configurada responde "no disponible", y no acepta claves que no generó el backend', async () => {
    const sinClave = new AlmacenamientoFirmasCifrado(carpeta, null);
    await expect(sinClave.guardar(crypto.randomUUID(), png)).rejects.toThrow(
      ServicioNoDisponibleError,
    );
    await expect(almacenamiento().leer('../../etc/passwd')).rejects.toThrow(
      /Clave de almacenamiento inválida/,
    );
  });

  it('nunca sobrescribe un archivo existente; leer uno que no existe da null', async () => {
    const a = almacenamiento();
    const clave = crypto.randomUUID();
    await a.guardar(clave, png);
    await expect(a.guardar(clave, png)).rejects.toThrow();
    expect(await a.leer(crypto.randomUUID())).toBeNull();
  });
});
