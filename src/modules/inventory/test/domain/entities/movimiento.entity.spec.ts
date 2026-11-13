import { ReglaNegocioError } from '../../../../../common/exceptions/errores_dominio.js';
import {
  type DatosMovimiento,
  Movimiento,
} from '../../../domain/entities/movimiento.entity.js';
import {
  AHORA,
  HOY,
  ambulancia,
  bodega,
  crearEquipo,
  crearInsumo,
  crearLote,
  insumoPorLote,
  insumoPorSerie,
  loteVencido,
} from '../../dobles/fabricas_inventario.js';

const gasa = crearInsumo();

function datos(cambios: Partial<DatosMovimiento>): DatosMovimiento {
  return {
    tipo: 'entrada',
    origen: null,
    destino: bodega(),
    lineas: [
      {
        insumo: gasa,
        lote: null,
        equipo: null,
        cantidad: 10,
        observaciones: null,
      },
    ],
    usuarioId: 'admin-1',
    asignacionId: null,
    motivo: null,
    observaciones: null,
    documentoReferencia: null,
    realizadoEn: null,
    ...cambios,
  };
}

describe('Movimiento', () => {
  it('nace en borrador con un código del día de Colombia', () => {
    const movimiento = Movimiento.crear(datos({}), AHORA);
    expect(movimiento.estado).toBe('borrador');
    expect(movimiento.codigo).toMatch(/^MOV-20261111-[0-9A-F]{8}$/);
    expect(movimiento.realizadoEn).toEqual(AHORA);
  });

  describe('origen y destino según el tipo', () => {
    it.each([
      ['entrada sin destino', { tipo: 'entrada' as const, destino: null }],
      [
        'entrada a una ambulancia',
        { tipo: 'entrada' as const, destino: ambulancia() },
      ],
      [
        'consumo desde bodega',
        { tipo: 'consumo' as const, origen: bodega(), destino: null },
      ],
      [
        'devolución a una ambulancia',
        {
          tipo: 'devolucion' as const,
          origen: ambulancia(),
          destino: ambulancia('amb-2'),
        },
      ],
      [
        'baja con destino',
        {
          tipo: 'baja' as const,
          origen: bodega(),
          destino: ambulancia(),
          motivo: 'Roto',
        },
      ],
      [
        'ajuste con origen y destino',
        {
          tipo: 'ajuste' as const,
          origen: bodega(),
          destino: ambulancia(),
          motivo: 'Conteo',
        },
      ],
      [
        'ajuste sin ubicaciones',
        {
          tipo: 'ajuste' as const,
          origen: null,
          destino: null,
          motivo: 'Conteo',
        },
      ],
    ])('rechaza %s', (_caso, cambios) => {
      expect(() => Movimiento.crear(datos(cambios), AHORA)).toThrow(
        ReglaNegocioError,
      );
    });

    it('rechaza origen y destino iguales', () => {
      const mismo = bodega();
      expect(() =>
        Movimiento.crear(
          datos({ tipo: 'transferencia', origen: mismo, destino: mismo }),
          AHORA,
        ),
      ).toThrow(/distintos/);
    });

    it('exige motivo en ajustes y bajas', () => {
      expect(() =>
        Movimiento.crear(
          datos({ tipo: 'baja', origen: bodega(), destino: null }),
          AHORA,
        ),
      ).toThrow(/motivo/);
    });

    it('solo el consumo se asocia a un servicio', () => {
      expect(() =>
        Movimiento.crear(datos({ asignacionId: 'asig-1' }), AHORA),
      ).toThrow(/consumo/);
    });

    it('rechaza ubicaciones inactivas', () => {
      const cerrada = bodega();
      cerrada.cambiarEstado(false);
      expect(() =>
        Movimiento.crear(datos({ destino: cerrada }), AHORA),
      ).toThrow(/inactiva/);
    });
  });

  describe('líneas', () => {
    it('exige lote para insumos por lote y equipo (cantidad 1) para los de serie', () => {
      const adrenalina = insumoPorLote();
      expect(() =>
        Movimiento.crear(
          datos({
            lineas: [
              {
                insumo: adrenalina,
                lote: null,
                equipo: null,
                cantidad: 1,
                observaciones: null,
              },
            ],
          }),
          AHORA,
        ),
      ).toThrow(/indique el lote/);

      const dea = insumoPorSerie();
      expect(() =>
        Movimiento.crear(
          datos({
            lineas: [
              {
                insumo: dea,
                lote: null,
                equipo: crearEquipo(dea),
                cantidad: 2,
                observaciones: null,
              },
            ],
          }),
          AHORA,
        ),
      ).toThrow(/de a una unidad/);
    });

    it('rechaza la misma unidad repetida y cantidades no positivas', () => {
      const linea = {
        insumo: gasa,
        lote: null,
        equipo: null,
        cantidad: 1,
        observaciones: null,
      };
      expect(() =>
        Movimiento.crear(datos({ lineas: [linea, linea] }), AHORA),
      ).toThrow(/repetido/);
      expect(() =>
        Movimiento.crear(datos({ lineas: [{ ...linea, cantidad: 0 }] }), AHORA),
      ).toThrow(/mayor que 0/);
      expect(() => Movimiento.crear(datos({ lineas: [] }), AHORA)).toThrow(
        /al menos un elemento/,
      );
    });

    it('no deja entrar insumos inactivos', () => {
      const inactivo = crearInsumo({ codigo: 'viejo' });
      inactivo.cambiarEstado(false, AHORA);
      expect(() =>
        Movimiento.crear(
          datos({
            lineas: [
              {
                insumo: inactivo,
                lote: null,
                equipo: null,
                cantidad: 1,
                observaciones: null,
              },
            ],
          }),
          AHORA,
        ),
      ).toThrow(/inactivo/);
    });

    it('no deja ir un lote vencido a una ambulancia ni consumirlo, pero sí darlo de baja', () => {
      const adrenalina = insumoPorLote();
      const linea = {
        insumo: adrenalina,
        lote: loteVencido(adrenalina),
        equipo: null,
        cantidad: 1,
        observaciones: null,
      };
      expect(() =>
        Movimiento.crear(
          datos({
            tipo: 'transferencia',
            origen: bodega(),
            destino: ambulancia(),
            lineas: [linea],
          }),
          AHORA,
        ),
      ).toThrow(/vencido/);
      expect(() =>
        Movimiento.crear(
          datos({
            tipo: 'consumo',
            origen: ambulancia(),
            destino: null,
            lineas: [linea],
          }),
          AHORA,
        ),
      ).toThrow(/vencido/);
      expect(
        Movimiento.crear(
          datos({
            tipo: 'baja',
            origen: bodega(),
            destino: null,
            motivo: 'Vencido',
            lineas: [linea],
          }),
          AHORA,
        ).estado,
      ).toBe('borrador');
    });

    it('un equipo fuera de operación no va a una ambulancia', () => {
      const dea = insumoPorSerie();
      const equipo = crearEquipo(dea);
      equipo.cambiarEstado('mantenimiento', AHORA);
      expect(() =>
        Movimiento.crear(
          datos({
            tipo: 'transferencia',
            origen: bodega(),
            destino: ambulancia(),
            lineas: [
              {
                insumo: dea,
                lote: null,
                equipo,
                cantidad: 1,
                observaciones: null,
              },
            ],
          }),
          AHORA,
        ),
      ).toThrow(/no está operativo/);
    });
  });

  describe('estados y efectos', () => {
    it('una transferencia resta en el origen y suma en el destino', () => {
      const adrenalina = insumoPorLote();
      const lote = crearLote(adrenalina);
      const origen = bodega();
      const destino = ambulancia();
      const movimiento = Movimiento.crear(
        datos({
          tipo: 'transferencia',
          origen,
          destino,
          lineas: [
            {
              insumo: adrenalina,
              lote,
              equipo: null,
              cantidad: 2.5,
              observaciones: null,
            },
          ],
        }),
        AHORA,
      );
      const efectos = movimiento.efectos();
      expect(efectos).toHaveLength(2);
      expect(efectos).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ubicacionId: origen.id,
            delta: -2.5,
            claveControl: `lote:${lote.id}`,
          }),
          expect.objectContaining({
            ubicacionId: destino.id,
            delta: 2.5,
            claveControl: `lote:${lote.id}`,
          }),
        ]),
      );
    });

    it('confirma o anula solo desde borrador', () => {
      const confirmado = Movimiento.crear(datos({}), AHORA);
      confirmado.confirmar(AHORA, HOY);
      expect(confirmado.estado).toBe('confirmado');
      expect(() => confirmado.anular(AHORA)).toThrow(/ya está confirmado/);

      const anulado = Movimiento.crear(datos({}), AHORA);
      anulado.anular(AHORA);
      expect(() => anulado.confirmar(AHORA, HOY)).toThrow(/ya está anulado/);
    });

    it('al confirmar revalida con la fecha de ese día', () => {
      const adrenalina = insumoPorLote();
      const movimiento = Movimiento.crear(
        datos({
          tipo: 'transferencia',
          origen: bodega(),
          destino: ambulancia(),
          lineas: [
            {
              insumo: adrenalina,
              lote: crearLote(adrenalina, '2026-11-20'),
              equipo: null,
              cantidad: 1,
              observaciones: null,
            },
          ],
        }),
        AHORA,
      );
      expect(() => movimiento.confirmar(AHORA, '2026-11-21')).toThrow(
        /vencido/,
      );
    });

    it('no acepta fechas futuras', () => {
      expect(() =>
        Movimiento.crear(
          datos({ realizadoEn: new Date(AHORA.getTime() + 60 * 60 * 1000) }),
          AHORA,
        ),
      ).toThrow(/futuro/);
    });
  });
});
