import { ReglaNegocioError } from '../../../../../common/exceptions/errores_dominio.js';
import {
  TAMANO_MAXIMO_DOCUMENTO_BYTES,
  validarArchivoDocumento,
} from '../../../domain/services/archivo_documento.js';
import { fotoJpg } from '../../dobles/ciudadanos_memoria.js';

function png(tamano = 20 * 1024) {
  const contenido = new Uint8Array(tamano);
  contenido.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return {
    nombreOriginal: 'cedula.PNG',
    tipoMimeDeclarado: 'image/png',
    contenido,
  };
}

describe('validarArchivoDocumento', () => {
  it('acepta JPG y PNG reales', () => {
    expect(validarArchivoDocumento(fotoJpg(), 'Foto').tipoMime).toBe(
      'image/jpeg',
    );
    expect(validarArchivoDocumento(png(), 'Foto').tipoMime).toBe('image/png');
  });

  it('rechaza un PDF renombrado como .jpg (mira los bytes, no el nombre)', () => {
    const falso = fotoJpg();
    falso.contenido.set([0x25, 0x50, 0x44, 0x46]);
    expect(() => validarArchivoDocumento(falso, 'Foto')).toThrow(
      'no es una foto JPG válida',
    );
  });

  it('rechaza una extensión que no corresponde al tipo', () => {
    expect(() =>
      validarArchivoDocumento(fotoJpg('cedula.exe'), 'Foto'),
    ).toThrow(ReglaNegocioError);
  });

  it('rechaza tipos no permitidos', () => {
    expect(() =>
      validarArchivoDocumento(
        { ...fotoJpg(), tipoMimeDeclarado: 'application/pdf' },
        'Foto',
      ),
    ).toThrow('solo se aceptan fotos JPG o PNG');
  });

  it('rechaza archivos demasiado grandes o demasiado pequeños', () => {
    expect(() =>
      validarArchivoDocumento(
        fotoJpg('a.jpg', TAMANO_MAXIMO_DOCUMENTO_BYTES + 1),
        'Foto',
      ),
    ).toThrow('supera el máximo');
    expect(() =>
      validarArchivoDocumento(fotoJpg('a.jpg', 100), 'Foto'),
    ).toThrow('demasiado pequeña');
  });
});
