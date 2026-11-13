import { ReglaNegocioError } from '../../../../../common/exceptions/errores_dominio.js';
import { AHORA, crearInsumo } from '../../dobles/fabricas_inventario.js';

describe('Insumo', () => {
  it('normaliza el código y redondea el stock mínimo a 3 decimales', () => {
    const insumo = crearInsumo({ codigo: '  med-01 ', stockMinimo: 1.23456 });
    expect(insumo.codigo).toBe('MED-01');
    expect(insumo.stockMinimo).toBe(1.235);
    expect(insumo.activo).toBe(true);
  });

  it('decide su control: serie, lote o solo cantidad', () => {
    expect(crearInsumo({ requiereSerie: true }).control).toBe('serie');
    expect(crearInsumo({ requiereLote: true }).control).toBe('lote');
    expect(crearInsumo().control).toBe('insumo');
  });

  it('rechaza serie y lote a la vez', () => {
    expect(() =>
      crearInsumo({ requiereSerie: true, requiereLote: true }),
    ).toThrow(ReglaNegocioError);
  });

  it('rechaza vencimiento sin lote', () => {
    expect(() =>
      crearInsumo({ requiereVencimiento: true, requiereLote: false }),
    ).toThrow(/requiere lote/);
  });

  it('detecta si un cambio altera su forma de control', () => {
    const insumo = crearInsumo({ requiereLote: true });
    expect(insumo.cambiaControl({ requiereLote: true, nombre: 'Otro' })).toBe(
      false,
    );
    expect(insumo.cambiaControl({ requiereLote: false })).toBe(true);
    expect(insumo.cambiaControl({ requiereSerie: true })).toBe(true);
  });

  it('actualiza solo lo enviado y conserva identidad y estado', () => {
    const insumo = crearInsumo({ categoria: 'Curación' });
    insumo.cambiarEstado(false, AHORA);
    insumo.actualizar({ nombre: ' Gasa 10x10 ', categoria: null }, AHORA);
    expect(insumo.nombre).toBe('Gasa 10x10');
    expect(insumo.categoria).toBeNull();
    expect(insumo.codigo).toBe('INS-1');
    expect(insumo.activo).toBe(false);
  });

  it('un insumo inactivo no se puede usar en lo nuevo', () => {
    const insumo = crearInsumo();
    insumo.cambiarEstado(false, AHORA);
    expect(() => insumo.exigirActivo()).toThrow(/inactivo/);
  });
});
