import { ConflictoNegocioError } from '../../../../../common/exceptions/errores_dominio.js';
import { Verificacion } from '../../../domain/entities/verificacion.entity.js';
import {
  AHORA,
  HOY,
  crearEquipo,
  crearInsumo,
  crearLote,
  insumoPorLote,
  insumoPorSerie,
  loteVencido,
} from '../../dobles/fabricas_inventario.js';

const gasa = crearInsumo();

function iniciar(tipo: 'inicio_turno' | 'extraordinaria' = 'inicio_turno') {
  return Verificacion.iniciar(
    {
      ubicacionId: 'ubi-1',
      turnoId: 'turno-1',
      responsableId: 'paramedico-1',
      tipo,
      observaciones: null,
    },
    AHORA,
  );
}

const referencia = (cantidadEsperada: number) => ({
  cantidadEsperada,
  perfilDetalleId: null,
  hoy: HOY,
});
const conteo = (
  cantidadEncontrada: number,
  estado: null | 'conforme' | 'faltante' | 'danado' | 'vencido' = null,
) => ({
  insumo: gasa,
  lote: null,
  equipo: null,
  cantidadEncontrada,
  estado,
  observaciones: null,
});

describe('Verificacion', () => {
  it('calcula el estado comparando lo encontrado con lo esperado', () => {
    const verificacion = iniciar();
    expect(
      verificacion.registrarConteo(conteo(10), referencia(10), AHORA).estado,
    ).toBe('conforme');
    expect(
      verificacion.registrarConteo(conteo(8), referencia(10), AHORA).estado,
    ).toBe('faltante');
    expect(
      verificacion.registrarConteo(conteo(12), referencia(10), AHORA).estado,
    ).toBe('sobrante');
  });

  it('contar otra vez la misma unidad reemplaza el conteo (mismo id)', () => {
    const verificacion = iniciar();
    const primero = verificacion.registrarConteo(
      conteo(8),
      referencia(10),
      AHORA,
    );
    const segundo = verificacion.registrarConteo(
      conteo(10),
      referencia(10),
      AHORA,
    );
    expect(verificacion.conteos).toHaveLength(1);
    expect(segundo.id).toBe(primero.id);
  });

  it('no acepta un estado que contradiga las cantidades', () => {
    expect(() =>
      iniciar().registrarConteo(conteo(8, 'conforme'), referencia(10), AHORA),
    ).toThrow(/se esperaban 10/);
    expect(() =>
      iniciar().registrarConteo(conteo(10, 'faltante'), referencia(10), AHORA),
    ).toThrow(/no es "faltante"/);
  });

  it('marca vencido el lote vencido y exige explicación para dañado', () => {
    const adrenalina = insumoPorLote();
    const verificacion = iniciar();
    const vencido = verificacion.registrarConteo(
      { ...conteo(2), insumo: adrenalina, lote: loteVencido(adrenalina) },
      referencia(2),
      AHORA,
    );
    expect(vencido.estado).toBe('vencido');
    expect(() =>
      verificacion.registrarConteo(
        {
          ...conteo(2, 'conforme'),
          insumo: adrenalina,
          lote: loteVencido(adrenalina),
        },
        referencia(2),
        AHORA,
      ),
    ).toThrow(/márquelo como vencido/);
    expect(() =>
      verificacion.registrarConteo(conteo(1, 'danado'), referencia(1), AHORA),
    ).toThrow(/Describa el daño/);
    expect(() =>
      verificacion.registrarConteo(
        {
          ...conteo(1, 'vencido'),
          insumo: adrenalina,
          lote: crearLote(adrenalina),
        },
        referencia(1),
        AHORA,
      ),
    ).toThrow(/Explique/);
  });

  it('un equipo se cuenta como 0 o 1', () => {
    const dea = insumoPorSerie();
    expect(() =>
      iniciar().registrarConteo(
        { ...conteo(2), insumo: dea, equipo: crearEquipo(dea) },
        referencia(1),
        AHORA,
      ),
    ).toThrow(/0 o 1/);
  });

  it('la de turno exige contar todo; la extraordinaria no', () => {
    const deTurno = iniciar();
    deTurno.registrarConteo(conteo(10), referencia(10), AHORA);
    expect(() =>
      deTurno.finalizar(['Adrenalina (lote L-1)'], null, AHORA),
    ).toThrow(/Faltan por contar/);

    const extraordinaria = iniciar('extraordinaria');
    extraordinaria.registrarConteo(conteo(9), referencia(10), AHORA);
    extraordinaria.finalizar(
      ['Adrenalina (lote L-1)'],
      'Se rompió un paquete',
      AHORA,
    );
    expect(extraordinaria.estado).toBe('con_novedades');
    expect(extraordinaria.observaciones).toBe('Se rompió un paquete');
  });

  it('queda completada si todo es conforme y ya no admite cambios', () => {
    const verificacion = iniciar();
    expect(() => verificacion.finalizar([], null, AHORA)).toThrow(
      /al menos un conteo/,
    );
    verificacion.registrarConteo(conteo(10), referencia(10), AHORA);
    expect(verificacion.sinContar([`insumo:${gasa.id}`, 'lote:x'])).toEqual([
      'lote:x',
    ]);
    verificacion.finalizar([], null, AHORA);
    expect(verificacion.estado).toBe('completada');
    expect(() =>
      verificacion.registrarConteo(conteo(10), referencia(10), AHORA),
    ).toThrow(/finalizada/);
  });

  describe('revisión de novedades', () => {
    function conNovedades() {
      const verificacion = iniciar();
      verificacion.registrarConteo(conteo(8), referencia(10), AHORA);
      verificacion.finalizar([], null, AHORA);
      return verificacion;
    }

    it('queda pendiente hasta que la central la revisa', () => {
      const verificacion = conNovedades();
      expect(verificacion.estaPendienteDeRevision()).toBe(true);

      verificacion.revisar(
        'admin-1',
        '  Repuesto con MOV-20261113-AAAA  ',
        AHORA,
      );
      expect(verificacion.estaPendienteDeRevision()).toBe(false);
      expect(verificacion.revision).toMatchObject({
        revisadaPorId: 'admin-1',
        revisadaEn: AHORA,
        resolucion: 'Repuesto con MOV-20261113-AAAA',
      });
    });

    it('se revisa una sola vez', () => {
      const verificacion = conNovedades();
      verificacion.revisar('admin-1', 'Repuesto', AHORA);
      expect(() => verificacion.revisar('admin-2', 'Otra vez', AHORA)).toThrow(
        ConflictoNegocioError,
      );
    });

    it('exige explicar cómo se resolvió', () => {
      expect(() => conNovedades().revisar('admin-1', '   ', AHORA)).toThrow(
        /resolución es obligatori/,
      );
    });

    it('no se revisa una completada ni una en borrador', () => {
      const completada = iniciar();
      completada.registrarConteo(conteo(10), referencia(10), AHORA);
      completada.finalizar([], null, AHORA);
      expect(completada.estaPendienteDeRevision()).toBe(false);
      expect(() => completada.revisar('admin-1', 'x', AHORA)).toThrow(
        /finalizada con novedades/,
      );
      expect(() => iniciar().revisar('admin-1', 'x', AHORA)).toThrow(
        /finalizada con novedades/,
      );
    });
  });
});
