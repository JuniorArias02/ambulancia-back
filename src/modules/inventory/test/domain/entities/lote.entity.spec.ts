import { ReglaNegocioError } from '../../../../../common/exceptions/errores_dominio.js';
import { Lote } from '../../../domain/entities/lote.entity.js';
import { RegistroSanitario } from '../../../domain/entities/registro_sanitario.entity.js';
import {
  AHORA,
  HOY,
  crearInsumo,
  crearLote,
  insumoPorLote,
  loteVencido,
} from '../../dobles/fabricas_inventario.js';

const datos = {
  numeroLote: 'L-9',
  recibidoEn: null,
  fechaFabricacion: null,
  fechaVencimiento: '2027-01-01',
  fabricante: null,
  proveedor: null,
  documentoSoporte: null,
  observaciones: null,
};

describe('Lote', () => {
  it('solo existe para insumos controlados por lote', () => {
    expect(() => Lote.crear(crearInsumo(), null, datos, AHORA, HOY)).toThrow(
      /no se controla por lote/,
    );
  });

  it('exige vencimiento cuando el insumo lo pide', () => {
    expect(() =>
      Lote.crear(
        insumoPorLote(),
        null,
        { ...datos, fechaVencimiento: null },
        AHORA,
        HOY,
      ),
    ).toThrow(/vencimiento/);
  });

  it('rechaza fechas imposibles o en desorden', () => {
    const insumo = insumoPorLote();
    expect(() =>
      Lote.crear(
        insumo,
        null,
        { ...datos, fechaVencimiento: '2027-02-30' },
        AHORA,
        HOY,
      ),
    ).toThrow(ReglaNegocioError);
    expect(() =>
      Lote.crear(
        insumo,
        null,
        { ...datos, fechaFabricacion: '2027-02-01' },
        AHORA,
        HOY,
      ),
    ).toThrow(/futuro/);
  });

  it('exige registro sanitario vigente y del mismo insumo si el insumo lo requiere', () => {
    const insumo = insumoPorLote({ requiereRegistroSanitario: true });
    expect(() => Lote.crear(insumo, null, datos, AHORA, HOY)).toThrow(
      /exige registro sanitario/,
    );

    const registro = {
      numeroRegistro: 'INVIMA-1',
      tipoRegistro: 'registro_sanitario' as const,
      fechaExpedicion: '2020-01-01',
      fechaVencimiento: '2026-01-01',
      titular: null,
      documentoUrl: null,
      estado: 'vigente' as const,
    };
    const vencido = RegistroSanitario.crear(insumo, registro, AHORA);
    expect(() => Lote.crear(insumo, vencido, datos, AHORA, HOY)).toThrow(
      /no está vigente/,
    );

    const deOtro = RegistroSanitario.crear(
      insumoPorLote({ codigo: 'otro' }),
      { ...registro, fechaVencimiento: null },
      AHORA,
    );
    expect(() => Lote.crear(insumo, deOtro, datos, AHORA, HOY)).toThrow(
      /no pertenece/,
    );
  });

  it('vence al terminar el día de su fecha', () => {
    const insumo = insumoPorLote();
    expect(crearLote(insumo, HOY).estaVencido(HOY)).toBe(false);
    expect(loteVencido(insumo).estaVencido(HOY)).toBe(true);
  });
});
