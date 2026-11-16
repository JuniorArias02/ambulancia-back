import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import {
  crearFirmaHistoria,
  type DatosNuevaFirmaHistoria,
  type ResumenFirmaHistoria,
} from '../../domain/entities/firma_historia.js';
import {
  DATOS_HISTORIA_VACIOS,
  type DatosHistoria,
} from '../../domain/entities/historia_clinica.entity.js';
import { faltantesDeFirmas } from '../../domain/politicas_firma.js';

const ahora = new Date('2026-11-15T15:00:00Z');
const imagen = {
  claveAlmacenamiento: 'clave',
  tipoMime: 'image/png' as const,
  tamanoBytes: 1000,
  anchoPx: 600,
  altoPx: 200,
  huellaSha256: 'a'.repeat(64),
};
const historia: DatosHistoria = {
  ...DATOS_HISTORIA_VACIOS,
  nombres: 'Juan Carlos',
  apellidos: 'Pérez',
  tipoDocumento: 'CC',
  numeroDocumento: '1090123456',
};

function firma(extra: Partial<DatosNuevaFirmaHistoria>, datos = historia) {
  return crearFirmaHistoria(
    {
      id: 'f1',
      historiaClinicaId: 'h1',
      rolFirmante: 'paciente',
      proposito: 'comprobante_atencion',
      imagen,
      firmadaEn: ahora,
      registradaPorId: 'p1',
      ahora,
      ...extra,
    },
    datos,
  );
}

describe('Firmas de la historia (dominio)', () => {
  it('el paciente firma con los datos de la historia, que deben estar completos', () => {
    expect(firma({})).toMatchObject({
      nombreFirmante: 'Juan Carlos Pérez',
      tipoDocumento: 'CC',
      numeroDocumento: '1090123456',
      textoVersion: 'v1',
    });
    expect(() => firma({}, { ...historia, numeroDocumento: null })).toThrow(
      /complete antes sus nombres y su documento/,
    );
  });

  it('el acudiente debe ser un familiar mayor de edad, con nombre y documento', () => {
    const acudiente = {
      rolFirmante: 'acudiente' as const,
      nombreFirmante: 'María Gómez',
      tipoDocumento: 'CC',
      numeroDocumento: '60.123.456',
      parentesco: 'madre' as const,
    };
    expect(firma(acudiente)).toMatchObject({
      numeroDocumento: '60123456',
      parentesco: 'madre',
    });
    expect(() => firma({ ...acudiente, tipoDocumento: 'TI' })).toThrow(
      /mayor de edad/,
    );
    expect(() => firma({ ...acudiente, parentesco: undefined })).toThrow(
      /familiar/,
    );
    expect(() => firma({ ...acudiente, nombreFirmante: ' ' })).toThrow(
      ReglaNegocioError,
    );
  });

  it('cada rol firma solo lo suyo y el receptor necesita su cargo', () => {
    expect(() =>
      firma({ rolFirmante: 'testigo', proposito: 'comprobante_atencion' }),
    ).toThrow(/no firma/);
    expect(() =>
      firma({
        rolFirmante: 'receptor',
        proposito: 'entrega',
        nombreFirmante: 'Dra. Ruiz',
      }),
    ).toThrow(/cargo/);
  });

  it('o imagen o motivo; el motivo solo en la fila del paciente y "otro" con detalle', () => {
    expect(() => firma({ motivoSinFirma: 'fallecido' })).toThrow(/no ambos/);
    expect(() => firma({ imagen: null })).toThrow(ReglaNegocioError);
    const sinFirma = firma(
      { imagen: null, motivoSinFirma: 'inconsciente_sin_acudiente' },
      DATOS_HISTORIA_VACIOS,
    );
    expect(sinFirma.imagen).toBeNull();
    expect(() => firma({ imagen: null, motivoSinFirma: 'otro' })).toThrow(
      /Describa/,
    );
  });

  it('el disentimiento solo con rechazo del traslado y su motivo', () => {
    expect(() => firma({ proposito: 'disentimiento' })).toThrow(
      /rechazo del traslado/,
    );
    expect(
      firma(
        { proposito: 'disentimiento' },
        {
          ...historia,
          desenlace: 'rechazo_traslado',
          motivoRechazo: 'No quiere ir',
        },
      ).proposito,
    ).toBe('disentimiento');
  });
});

describe('Política de firmas por modalidad', () => {
  const resumen = (
    rolFirmante: ResumenFirmaHistoria['rolFirmante'],
    proposito: ResumenFirmaHistoria['proposito'],
    motivoSinFirma: ResumenFirmaHistoria['motivoSinFirma'] = null,
  ): ResumenFirmaHistoria => ({
    rolFirmante,
    proposito,
    conImagen: motivoSinFirma === null,
    motivoSinFirma,
  });

  it('emergencia: el comprobante se firma o se explica por qué no; el receptor es opcional', () => {
    expect(faltantesDeFirmas('emergencia', 'trasladado', [])).toEqual([
      expect.stringMatching(/comprobante de atención.*o el motivo/),
    ]);
    expect(
      faltantesDeFirmas('emergencia', 'trasladado', [
        resumen(
          'paciente',
          'comprobante_atencion',
          'inconsciente_sin_acudiente',
        ),
      ]),
    ).toEqual([]);
  });

  it('traslado programado: comprobante firmado (sin excusa) y firma del receptor', () => {
    const faltan = faltantesDeFirmas('traslado_programado', 'trasladado', [
      resumen('paciente', 'comprobante_atencion', 'inconsciente_sin_acudiente'),
    ]);
    expect(faltan).toEqual([
      expect.stringMatching(/obligatoria en esta modalidad/),
      expect.stringMatching(/quien recibe/),
    ]);
    expect(
      faltantesDeFirmas('traslado_programado', 'trasladado', [
        resumen('acudiente', 'comprobante_atencion'),
        resumen('receptor', 'entrega'),
      ]),
    ).toEqual([]);
  });

  it('rechazo: disentimiento siempre; si el paciente se niega, testigo', () => {
    expect(
      faltantesDeFirmas('traslado_programado', 'rechazo_traslado', []),
    ).toEqual([expect.stringMatching(/disentimiento/)]);
    expect(
      faltantesDeFirmas('emergencia', 'rechazo_traslado', [
        resumen('paciente', 'disentimiento', 'se_nego'),
      ]),
    ).toEqual([expect.stringMatching(/testigo/)]);
    expect(
      faltantesDeFirmas('emergencia', 'rechazo_traslado', [
        resumen('paciente', 'disentimiento', 'se_nego'),
        resumen('testigo', 'disentimiento'),
      ]),
    ).toEqual([]);
  });

  it('fallecido en el sitio o sin desenlace: no exige firmas', () => {
    expect(
      faltantesDeFirmas('traslado_programado', 'fallecido_en_sitio', []),
    ).toEqual([]);
    expect(faltantesDeFirmas('emergencia', null, [])).toEqual([]);
  });
});
