import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import { FirmaUsuario } from '../../domain/entities/firma_usuario.entity.js';

function nueva() {
  return FirmaUsuario.registrar({
    usuarioId: 'u1',
    claveAlmacenamiento: crypto.randomUUID(),
    imagen: { tamanoBytes: 1000, anchoPx: 600, altoPx: 200 },
    huellaSha256: 'a'.repeat(64),
    fecha: new Date('2026-11-14T15:00:00Z'),
  });
}

describe('FirmaUsuario', () => {
  it('se registra vigente, como PNG', () => {
    const firma = nueva();
    expect(firma.estado).toBe('vigente');
    expect(firma.tipoMime).toBe('image/png');
  });

  it('el administrador la desactiva con un motivo, y no se puede desactivar dos veces', () => {
    const firma = nueva();
    firma.desactivar({
      porId: 'admin',
      motivo: '  Firma ilegible  ',
      fecha: new Date(),
    });

    expect(firma.estado).toBe('desactivada');
    expect(firma.motivoDesactivacion).toBe('Firma ilegible');
    expect(() =>
      firma.desactivar({
        porId: 'admin',
        motivo: 'Otra vez',
        fecha: new Date(),
      }),
    ).toThrow(/ya no está vigente/);
  });

  it('exige un motivo de al menos 5 caracteres', () => {
    expect(() =>
      nueva().desactivar({ porId: 'admin', motivo: ' no ', fecha: new Date() }),
    ).toThrow(ReglaNegocioError);
  });

  it('una reemplazada se distingue de una desactivada', () => {
    const firma = nueva();
    const reemplazada = FirmaUsuario.reconstruir({
      id: firma.id,
      usuarioId: firma.usuarioId,
      claveAlmacenamiento: firma.claveAlmacenamiento,
      tipoMime: 'image/png',
      tamanoBytes: 1000,
      anchoPx: 600,
      altoPx: 200,
      huellaSha256: firma.huellaSha256,
      vigente: false,
      registradaEn: firma.registradaEn,
      reemplazadaEn: new Date(),
      desactivadaEn: null,
      desactivadaPorId: null,
      motivoDesactivacion: null,
    });
    expect(reemplazada.estado).toBe('reemplazada');
  });
});
