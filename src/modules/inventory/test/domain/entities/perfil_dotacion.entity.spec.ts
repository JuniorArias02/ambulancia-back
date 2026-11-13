import {
  type DatosDetallePerfil,
  PerfilDotacion,
} from '../../../domain/entities/perfil_dotacion.entity.js';
import {
  AHORA,
  HOY,
  crearInsumo,
  insumoPorSerie,
} from '../../dobles/fabricas_inventario.js';

const gasa = crearInsumo();
const detalle: DatosDetallePerfil = {
  cantidadRequerida: 10,
  cantidadMinima: 5,
  obligatorio: true,
  observaciones: null,
};

function perfil(detalles = [{ ...detalle, insumo: gasa }]) {
  return PerfilDotacion.crear(
    {
      tipoAmbulanciaId: 'tab',
      codigo: 'dot-tab',
      nombre: 'Dotación TAB',
      descripcion: null,
      vigenteDesde: null,
      vigenteHasta: null,
      detalles,
    },
    1,
    AHORA,
  );
}

describe('PerfilDotacion', () => {
  it('nace inactivo y con el código en mayúscula', () => {
    const creado = perfil();
    expect(creado.activo).toBe(false);
    expect(creado.codigo).toBe('DOT-TAB');
    expect(creado.vigenteEn(HOY)).toBe(false);
  });

  it('no repite insumos y valida cantidades', () => {
    expect(() =>
      perfil([
        { ...detalle, insumo: gasa },
        { ...detalle, insumo: gasa },
      ]),
    ).toThrow(/ya está/);
    expect(() =>
      perfil([{ ...detalle, cantidadMinima: 11, insumo: gasa }]),
    ).toThrow(/no puede superar/);
    expect(() =>
      perfil([
        {
          ...detalle,
          cantidadRequerida: 1.5,
          cantidadMinima: null,
          insumo: insumoPorSerie(),
        },
      ]),
    ).toThrow(/enteras/);
  });

  it('se activa solo con elementos y vigencia abierta; rige dentro de su vigencia', () => {
    expect(() => perfil([]).activar(HOY, AHORA)).toThrow(
      /al menos un elemento/,
    );

    const vencido = perfil();
    vencido.actualizar({ vigenteHasta: '2026-01-01' }, AHORA);
    expect(() => vencido.activar(HOY, AHORA)).toThrow(/vigencia/);

    const futuro = perfil();
    futuro.actualizar({ vigenteDesde: '2026-12-01' }, AHORA);
    futuro.activar(HOY, AHORA);
    expect(futuro.vigenteEn(HOY)).toBe(false);
    expect(futuro.vigenteEn('2026-12-01')).toBe(true);
  });

  it('un perfil activo no queda vacío', () => {
    const activo = perfil();
    activo.activar(HOY, AHORA);
    expect(() =>
      activo.quitarDetalle(activo.detalles[0]?.id ?? '', AHORA),
    ).toThrow(/sin elementos/);
  });

  it('la versión nueva copia los elementos con ids nuevos, inactiva y sin vigencia', () => {
    const base = perfil();
    base.actualizar({ vigenteDesde: '2026-01-01' }, AHORA);
    const nueva = base.nuevaVersion(2, AHORA);
    expect(nueva.version).toBe(2);
    expect(nueva.activo).toBe(false);
    expect(nueva.vigenteDesde).toBeNull();
    expect(nueva.detalles[0]?.insumoId).toBe(gasa.id);
    expect(nueva.detalles[0]?.id).not.toBe(base.detalles[0]?.id);
  });
});
