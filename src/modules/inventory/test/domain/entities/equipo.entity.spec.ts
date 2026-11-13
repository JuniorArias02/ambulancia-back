import {
  HOY,
  AHORA,
  crearEquipo,
  crearInsumo,
  insumoPorSerie,
} from '../../dobles/fabricas_inventario.js';

const mantenimiento = {
  tipo: 'preventivo' as const,
  fechaMantenimiento: '2026-11-01',
  fechaProximo: '2027-05-01',
  responsable: null,
  proveedor: null,
  documentoSoporte: null,
  resultado: 'aprobado',
  observaciones: null,
};

describe('Equipo', () => {
  it('solo existe para insumos controlados por serie y nace operativo', () => {
    expect(() => crearEquipo(crearInsumo())).toThrow(/número de serie/);
    expect(crearEquipo(insumoPorSerie()).estado).toBe('operativo');
  });

  it('un mantenimiento reciente actualiza las fechas; uno viejo solo queda en el historial', () => {
    const equipo = crearEquipo(insumoPorSerie());
    equipo.registrarMantenimiento(mantenimiento, AHORA, HOY);
    expect(equipo.fechaUltimoMantenimiento).toBe('2026-11-01');
    expect(equipo.fechaProximoMantenimiento).toBe('2027-05-01');

    const viejo = equipo.registrarMantenimiento(
      {
        ...mantenimiento,
        fechaMantenimiento: '2026-01-01',
        fechaProximo: null,
      },
      AHORA,
      HOY,
    );
    expect(viejo.fechaMantenimiento).toBe('2026-01-01');
    expect(equipo.fechaUltimoMantenimiento).toBe('2026-11-01');
    expect(equipo.fechaProximoMantenimiento).toBe('2027-05-01');
  });

  it('rechaza mantenimientos futuros o con próxima fecha anterior', () => {
    const equipo = crearEquipo(insumoPorSerie());
    expect(() =>
      equipo.registrarMantenimiento(
        { ...mantenimiento, fechaMantenimiento: '2026-12-01' },
        AHORA,
        HOY,
      ),
    ).toThrow(/futura/);
    expect(() =>
      equipo.registrarMantenimiento(
        { ...mantenimiento, fechaProximo: '2026-10-01' },
        AHORA,
        HOY,
      ),
    ).toThrow(/posterior/);
  });

  it('la baja es definitiva', () => {
    const equipo = crearEquipo(insumoPorSerie());
    equipo.cambiarEstado('baja', AHORA);
    expect(() => equipo.cambiarEstado('operativo', AHORA)).toThrow(
      /dado de baja/,
    );
    expect(() =>
      equipo.registrarMantenimiento(mantenimiento, AHORA, HOY),
    ).toThrow(/dado de baja/);
  });
});
