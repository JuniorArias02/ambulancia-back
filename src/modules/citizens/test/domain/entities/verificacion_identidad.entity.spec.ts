import {
  AccesoDenegadoError,
  ReglaNegocioError,
} from '../../../../../common/exceptions/errores_dominio.js';
import {
  type DocumentoIdentidad,
  type EstadoVerificacion,
  type LadoDocumento,
  VerificacionIdentidad,
} from '../../../domain/entities/verificacion_identidad.entity.js';

function documento(lado: LadoDocumento): DocumentoIdentidad {
  return {
    id: crypto.randomUUID(),
    lado,
    claveAlmacenamiento: crypto.randomUUID(),
    tipoMime: 'image/jpeg',
    tamanoBytes: 20_000,
    huellaSha256: 'a'.repeat(64),
    cargadoEn: new Date(),
  };
}

function enEstado(estado: EstadoVerificacion): VerificacionIdentidad {
  return VerificacionIdentidad.reconstruir({
    id: 'v1',
    usuarioId: 'ciudadano-1',
    estado,
    motivo: null,
    enviadaEn: new Date(),
    revisadaPorId: null,
    revisadaEn: null,
    documentos: [documento('frontal'), documento('posterior')],
  });
}

const admin = { revisorId: 'admin-1', fecha: new Date() };

describe('VerificacionIdentidad', () => {
  it('nace pendiente, con las dos caras y su primer registro de historial', () => {
    const { verificacion, cambio } = VerificacionIdentidad.iniciar({
      usuarioId: 'ciudadano-1',
      documentos: [documento('frontal'), documento('posterior')],
      fecha: new Date(),
    });

    expect(verificacion.estado).toBe('pendiente');
    expect(verificacion.permiteReportar()).toBe(false);
    expect(cambio).toEqual(
      expect.objectContaining({
        estadoAnterior: null,
        estadoNuevo: 'pendiente',
        responsableId: 'ciudadano-1',
      }),
    );
  });

  it('exige la foto frontal y la posterior', () => {
    expect(() =>
      VerificacionIdentidad.iniciar({
        usuarioId: 'c1',
        documentos: [documento('frontal')],
        fecha: new Date(),
      }),
    ).toThrow(ReglaNegocioError);
  });

  it.each([
    'pendiente',
    'en_revision',
    'rechazado',
    'requiere_correccion',
  ] as const)('en %s no permite reportar', (estado) => {
    expect(enEstado(estado).permiteReportar()).toBe(false);
  });

  it('solo verificado permite reportar', () => {
    expect(enEstado('verificado').permiteReportar()).toBe(true);
  });

  it('el administrador la toma, la aprueba y queda registrado quién y cuándo', () => {
    const verificacion = enEstado('pendiente');

    verificacion.decidir({ ...admin, decision: 'en_revision' });
    const cambio = verificacion.decidir({ ...admin, decision: 'verificado' });

    expect(verificacion.estado).toBe('verificado');
    expect(verificacion.revisadaPorId).toBe('admin-1');
    expect(cambio).toEqual(
      expect.objectContaining({
        estadoAnterior: 'en_revision',
        estadoNuevo: 'verificado',
      }),
    );
  });

  it('rechazar o pedir corrección exige un motivo, que verá el ciudadano', () => {
    expect(() =>
      enEstado('pendiente').decidir({ ...admin, decision: 'rechazado' }),
    ).toThrow(ReglaNegocioError);

    const verificacion = enEstado('en_revision');
    const cambio = verificacion.decidir({
      ...admin,
      decision: 'requiere_correccion',
      motivo: 'La foto posterior está borrosa',
      observaciones: 'Nota interna',
    });
    expect(verificacion.motivo).toBe('La foto posterior está borrosa');
    expect(cambio.observaciones).toBe('Nota interna');
  });

  it('verificado y rechazado son finales', () => {
    expect(() =>
      enEstado('verificado').decidir({
        ...admin,
        decision: 'rechazado',
        motivo: 'x',
      }),
    ).toThrow(ReglaNegocioError);
    expect(() =>
      enEstado('rechazado').decidir({ ...admin, decision: 'verificado' }),
    ).toThrow(ReglaNegocioError);
  });

  it('nadie revisa su propia verificación', () => {
    expect(() =>
      enEstado('pendiente').decidir({
        revisorId: 'ciudadano-1',
        fecha: new Date(),
        decision: 'verificado',
      }),
    ).toThrow(AccesoDenegadoError);
  });

  it('el reenvío reemplaza solo el lado enviado y vuelve a pendiente', () => {
    const verificacion = enEstado('requiere_correccion');
    const posteriorAnterior = verificacion.documentos.find(
      (d) => d.lado === 'posterior',
    );
    const nuevo = documento('posterior');

    const { cambio, reemplazados } = verificacion.reenviar({
      documentosNuevos: [nuevo],
      fecha: new Date(),
    });

    expect(verificacion.estado).toBe('pendiente');
    expect(verificacion.motivo).toBeNull();
    expect(reemplazados).toEqual([posteriorAnterior]);
    expect(verificacion.documentos.map((d) => d.lado).sort()).toEqual([
      'frontal',
      'posterior',
    ]);
    expect(cambio.responsableId).toBe('ciudadano-1');
  });

  it('solo se reenvía cuando se pidió una corrección', () => {
    for (const estado of ['pendiente', 'verificado', 'rechazado'] as const) {
      expect(() =>
        enEstado(estado).reenviar({ documentosNuevos: [], fecha: new Date() }),
      ).toThrow(ReglaNegocioError);
    }
  });
});
