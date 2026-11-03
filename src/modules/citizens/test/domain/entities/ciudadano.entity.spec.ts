import { ReglaNegocioError } from '../../../../../common/exceptions/errores_dominio.js';
import { Ciudadano } from '../../../domain/entities/ciudadano.entity.js';
import {
  type EstadoVerificacion,
  VerificacionIdentidad,
} from '../../../domain/entities/verificacion_identidad.entity.js';

const HOY = new Date('2026-11-02T15:00:00Z');

function verificacion(estado: EstadoVerificacion = 'pendiente') {
  return VerificacionIdentidad.reconstruir({
    id: 'v1',
    usuarioId: 'c1',
    estado,
    motivo: null,
    enviadaEn: HOY,
    revisadaPorId: null,
    revisadaEn: null,
    documentos: [],
  });
}

function registrar(
  cambios: Partial<Parameters<typeof Ciudadano.registrar>[0]> = {},
) {
  return Ciudadano.registrar(
    {
      id: 'c1',
      nombres: ' Laura ',
      apellidos: 'Gómez',
      tipoDocumento: 'CC',
      numeroDocumento: '1.090.123-456',
      fechaNacimiento: '1990-05-17',
      correo: ' Laura@Correo.CO ',
      telefono: '3001234567',
      verificacion: verificacion(),
      ...cambios,
    },
    HOY,
  );
}

describe('Ciudadano', () => {
  it('normaliza el documento, el correo y los nombres', () => {
    const ciudadano = registrar();

    expect(ciudadano.numeroDocumento).toBe('1090123456');
    expect(ciudadano.correo).toBe('laura@correo.co');
    expect(ciudadano.nombres).toBe('Laura');
  });

  it('solo muestra los últimos 4 dígitos del documento al ciudadano', () => {
    expect(registrar().documentoEnmascarado()).toBe('••••••3456');
  });

  it('no registra menores de edad (cuenta el día en Colombia)', () => {
    expect(() => registrar({ fechaNacimiento: '2008-11-03' })).toThrow(
      'Debe ser mayor de 18',
    );
    expect(registrar({ fechaNacimiento: '2008-11-02' }).fechaNacimiento).toBe(
      '2008-11-02',
    );
  });

  it('rechaza fechas imposibles o futuras', () => {
    for (const fecha of [
      '1990-02-30',
      '2030-01-01',
      '17/05/1990',
      '1890-01-01',
    ]) {
      expect(() => registrar({ fechaNacimiento: fecha })).toThrow(
        ReglaNegocioError,
      );
    }
  });

  it('rechaza un documento con caracteres no permitidos', () => {
    expect(() => registrar({ numeroDocumento: '12#45' })).toThrow(
      ReglaNegocioError,
    );
  });

  it('la identidad solo se corrige cuando el administrador lo pidió', () => {
    expect(() =>
      registrar({ verificacion: verificacion('verificado') }).corregirIdentidad(
        { numeroDocumento: '999999' },
        HOY,
      ),
    ).toThrow(ReglaNegocioError);

    const enCorreccion = registrar({
      verificacion: verificacion('requiere_correccion'),
    });
    enCorreccion.corregirIdentidad({ numeroDocumento: '99.888.777' }, HOY);
    expect(enCorreccion.numeroDocumento).toBe('99888777');
  });
});
