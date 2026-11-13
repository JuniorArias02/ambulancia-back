import { PerfilDotacion } from '../../../domain/entities/perfil_dotacion.entity.js';
import { compararDotacion } from '../../../domain/services/comparacion_dotacion.js';
import {
  AHORA,
  HOY,
  crearInsumo,
  existencia,
} from '../../dobles/fabricas_inventario.js';

const gasa = crearInsumo({ codigo: 'gasa' });
const suero = crearInsumo({ codigo: 'suero', nombre: 'Suero' });
const guantes = crearInsumo({ codigo: 'guantes', nombre: 'Guantes' });

const perfil = PerfilDotacion.crear(
  {
    tipoAmbulanciaId: 'tab',
    codigo: 'DOT',
    nombre: 'Dotación',
    descripcion: null,
    vigenteDesde: null,
    vigenteHasta: null,
    detalles: [
      {
        insumo: gasa,
        cantidadRequerida: 10,
        cantidadMinima: 5,
        obligatorio: true,
        observaciones: null,
      },
      {
        insumo: suero,
        cantidadRequerida: 4,
        cantidadMinima: null,
        obligatorio: true,
        observaciones: null,
      },
    ],
  },
  1,
  AHORA,
);

describe('compararDotacion', () => {
  it('clasifica completo, incompleto y bajo el mínimo sin contar lo vencido', () => {
    const resultado = compararDotacion(
      perfil,
      [
        existencia({ insumoId: gasa.id, cantidad: 6 }),
        existencia({
          insumoId: suero.id,
          cantidad: 4,
          claveControl: 'lote:a',
          loteVencimiento: '2026-01-01',
        }),
        existencia({
          insumoId: suero.id,
          cantidad: 2,
          claveControl: 'lote:b',
          loteVencimiento: '2027-01-01',
        }),
        existencia({ insumoId: guantes.id, cantidad: 50 }),
      ],
      HOY,
    );
    const porInsumo = new Map(resultado.items.map((i) => [i.insumoId, i]));
    expect(porInsumo.get(gasa.id)).toMatchObject({
      disponible: 6,
      estado: 'incompleto',
      faltante: 4,
    });
    expect(porInsumo.get(suero.id)).toMatchObject({
      disponible: 2,
      noUtilizable: 4,
      estado: 'bajo_minimo',
    });
    expect(resultado.adicionales.map((a) => a.insumoId)).toEqual([guantes.id]);
    expect(resultado.completa).toBe(false);
  });

  it('sin perfil vigente todo queda como adicional y completa es null', () => {
    const resultado = compararDotacion(
      null,
      [existencia({ insumoId: gasa.id, cantidad: 1 })],
      HOY,
    );
    expect(resultado.completa).toBeNull();
    expect(resultado.adicionales).toHaveLength(1);
  });

  it('un equipo en mantenimiento no cuenta como disponible', () => {
    const resultado = compararDotacion(
      null,
      [
        existencia({
          insumoId: gasa.id,
          cantidad: 1,
          equipoEstado: 'mantenimiento',
        }),
      ],
      HOY,
    );
    expect(resultado.adicionales[0]).toMatchObject({
      disponible: 0,
      noUtilizable: 1,
    });
  });
});
