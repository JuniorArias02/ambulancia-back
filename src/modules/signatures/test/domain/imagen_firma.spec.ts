import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import { validarImagenFirma } from '../../domain/services/imagen_firma.js';
import { crearPngPrueba } from '../dobles/firmas_memoria.js';

describe('validarImagenFirma', () => {
  it('acepta un PNG completo y devuelve tamaño y dimensiones', () => {
    const png = crearPngPrueba(600, 200);
    expect(validarImagenFirma(png)).toEqual({
      tamanoBytes: png.byteLength,
      anchoPx: 600,
      altoPx: 200,
    });
  });

  it('rechaza lo que no es PNG aunque se llame así (por ejemplo, un JPEG)', () => {
    const jpeg = new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xe0,
      ...Array.from({ length: 60 }, () => 0),
    ]);
    expect(() => validarImagenFirma(jpeg)).toThrow(/PNG completa/);
  });

  it('rechaza un PNG cortado (sin el fragmento final)', () => {
    const png = crearPngPrueba();
    expect(() =>
      validarImagenFirma(png.subarray(0, png.byteLength - 12)),
    ).toThrow(ReglaNegocioError);
  });

  it('rechaza dimensiones que no son de una firma', () => {
    expect(() => validarImagenFirma(crearPngPrueba(100, 40))).toThrow(
      /píxeles/,
    );
    expect(() => validarImagenFirma(crearPngPrueba(2500, 300))).toThrow(
      /píxeles/,
    );
  });

  it('rechaza un archivo vacío o de más de 200 KB', () => {
    expect(() => validarImagenFirma(new Uint8Array())).toThrow(/Adjunte/);
    expect(() => validarImagenFirma(new Uint8Array(200 * 1024 + 1))).toThrow(
      /200 KB/,
    );
  });
});
