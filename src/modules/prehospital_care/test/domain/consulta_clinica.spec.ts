import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import { inicioDiaColombia } from '../../../../common/utils/fecha_colombia.js';
import {
  calcularTiemposServicio,
  edadEnAnios,
  estadosDelFiltro,
  filtrosUsados,
  muestrearRecorrido,
  normalizarDocumento,
  palabrasDeNombre,
  rangoDesdeDias,
  tipoDeAccion,
} from '../../domain/consulta_clinica.js';

describe('Consulta clínica (dominio)', () => {
  it('el día de Colombia empieza a las 05:00 UTC; una fecha inexistente da null', () => {
    expect(inicioDiaColombia('2026-11-14')?.toISOString()).toBe(
      '2026-11-14T05:00:00.000Z',
    );
    expect(inicioDiaColombia('2026-02-30')).toBeNull();
  });

  it('el rango incluye todo el día "hasta" (hasta el inicio del día siguiente)', () => {
    const rango = rangoDesdeDias('2026-11-01', '2026-11-14');
    expect(rango.desde?.toISOString()).toBe('2026-11-01T05:00:00.000Z');
    expect(rango.hastaExclusivo?.toISOString()).toBe(
      '2026-11-15T05:00:00.000Z',
    );
    expect(rangoDesdeDias(undefined, '2026-11-14').desde).toBeNull();
  });

  it('rechaza desde > hasta, fechas inexistentes y rangos de más de 366 días', () => {
    expect(() => rangoDesdeDias('2026-11-15', '2026-11-14')).toThrow(
      /posterior/,
    );
    expect(() => rangoDesdeDias('2026-02-30', undefined)).toThrow(
      ReglaNegocioError,
    );
    expect(() => rangoDesdeDias('2025-01-01', '2026-11-14')).toThrow(/366/);
    expect(() => rangoDesdeDias('2025-11-14', '2026-11-14')).not.toThrow();
  });

  it('por defecto busca las vigentes (borrador y cerrada); las anuladas solo si se piden', () => {
    expect(estadosDelFiltro(undefined)).toEqual(['borrador', 'cerrada']);
    expect(estadosDelFiltro('anulada')).toEqual(['anulada']);
    expect(estadosDelFiltro('todos')).toHaveLength(3);
  });

  it('normaliza el nombre en palabras y el documento como se guarda', () => {
    expect(palabrasDeNombre('  juan  Pérez  a ')).toEqual(['juan', 'Pérez']);
    expect(normalizarDocumento('1.090-123 456')).toBe('1090123456');
  });

  it('calcula la edad cumplida a la fecha de la atención', () => {
    const nacimiento = new Date('1990-11-15T00:00:00Z');
    expect(edadEnAnios(nacimiento, new Date('2026-11-14T12:00:00Z'))).toBe(35);
    expect(edadEnAnios(nacimiento, new Date('2026-11-15T12:00:00Z'))).toBe(36);
  });

  it('la auditoría recibe los nombres de los filtros, nunca sus valores', () => {
    const usados = filtrosUsados({
      rango: rangoDesdeDias('2026-11-01', undefined),
      campoFecha: 'evento',
      documento: '1090123456',
      palabrasNombre: ['juan'],
      estados: ['cerrada'],
      orden: 'fecha_desc',
      pagina: 1,
      limite: 20,
    });
    expect(usados).toEqual(['fecha_evento', 'documento', 'nombre']);
    expect(JSON.stringify(usados)).not.toContain('1090123456');
  });

  it('calcula los tiempos del servicio y deja null lo que no tiene las dos marcas', () => {
    const t = (min: number) => new Date(Date.UTC(2026, 10, 14, 15, min));
    const tiempos = calcularTiemposServicio({
      recibidaEn: t(0),
      asignadaEn: t(2),
      salidaEn: t(4),
      llegadaEscenaEn: t(14),
      salidaEscenaEn: t(30),
      llegadaDestinoEn: t(45),
      finalizadaEn: null,
    });
    expect(tiempos).toEqual({
      despachoSegundos: 120,
      alistamientoSegundos: 120,
      respuestaSegundos: 720,
      enEscenaSegundos: 960,
      trasladoSegundos: 900,
      totalSegundos: null,
    });
  });

  it('muestrea el recorrido con el primer y el último punto', () => {
    const puntos = Array.from({ length: 5000 }, (_, i) => i);
    const muestra = muestrearRecorrido(puntos, 1500);
    expect(muestra).toHaveLength(1500);
    expect(muestra[0]).toBe(0);
    expect(muestra.at(-1)).toBe(4999);
    expect(muestrearRecorrido([1, 2, 3], 1500)).toEqual([1, 2, 3]);
  });

  it('clasifica las acciones de la auditoría', () => {
    expect(tipoDeAccion('abrir')).toBe('creacion');
    expect(tipoDeAccion('registrar_signo_vital')).toBe('modificacion');
    expect(tipoDeAccion('cerrar')).toBe('firma');
    expect(tipoDeAccion('anular')).toBe('anulacion');
    expect(tipoDeAccion('consultar_firma_cierre')).toBe('consulta');
  });
});
