import { PublicadorEventosMemoria } from '../../../../../../test/dobles/publicador_eventos_memoria.js';
import {
  RutasMemoria,
  crearRutaPrueba,
} from '../../../../../../test/dobles/rutas_memoria.js';
import type { CalcularRutaEntrada } from '../../../application/use-cases/calcular_ruta_asignacion.use-case.js';
import { CalcularRutaAsignacion } from '../../../application/use-cases/calcular_ruta_asignacion.use-case.js';
import { RecalculadorRutas } from '../../../presentation/listeners/recalculador_rutas.listener.js';

/** Registra los cálculos pedidos sin ejecutar nada. */
class CalcularRutaEspia {
  pedidos: CalcularRutaEntrada[] = [];
  resultado: unknown = null;

  ejecutar(datos: CalcularRutaEntrada) {
    this.pedidos.push(datos);
    return Promise.resolve(this.resultado);
  }
}

describe('RecalculadorRutas', () => {
  const configuracion = {
    distanciaDesvioMetros: 150,
    intervaloRecalculoMs: 60_000,
  };
  let rutas: RutasMemoria;
  let calcular: CalcularRutaEspia;
  let recalculador: RecalculadorRutas;

  function gps(
    latitud: number,
    longitud: number,
    asignacionId: string | null = 'a1',
  ) {
    return recalculador.alOcurrir({
      tipo: 'ambulancia.ubicacion_actualizada',
      ambulanciaId: 'amb-1',
      asignacionId,
      latitud,
      longitud,
      velocidad: null,
      registradaEn: new Date(),
    });
  }

  beforeEach(() => {
    rutas = new RutasMemoria();
    calcular = new CalcularRutaEspia();
    recalculador = new RecalculadorRutas(
      new PublicadorEventosMemoria(),
      calcular as unknown as CalcularRutaAsignacion,
      rutas,
      configuracion,
    );
  });

  it('calcula al despachar', async () => {
    await recalculador.alOcurrir({
      tipo: 'asignacion.creada',
      asignacionId: 'a1',
    });
    expect(calcular.pedidos).toEqual([
      { asignacionId: 'a1', motivo: 'despacho' },
    ]);
  });

  it('con la ambulancia sobre la ruta no recalcula (no gasta cuota)', async () => {
    await rutas.guardar(
      crearRutaPrueba('a1', { calculadaEn: new Date(Date.now() - 120_000) }),
    );
    await gps(7.9, -72.502);
    expect(calcular.pedidos).toHaveLength(0);
  });

  it('si se desvía, recalcula desde donde está', async () => {
    await rutas.guardar(
      crearRutaPrueba('a1', { calculadaEn: new Date(Date.now() - 120_000) }),
    );
    await gps(7.88, -72.53);
    expect(calcular.pedidos).toEqual([
      {
        asignacionId: 'a1',
        motivo: 'desvio',
        origen: { latitud: 7.88, longitud: -72.53 },
      },
    ]);
  });

  it('desviada pero recién calculada: espera el intervalo mínimo', async () => {
    await rutas.guardar(crearRutaPrueba('a1'));
    await gps(7.88, -72.53);
    expect(calcular.pedidos).toHaveLength(0);
  });

  it('sin ruta todavía, la primera posición dispara el cálculo, y no en cada reporte si falla', async () => {
    await gps(7.8939, -72.5078);
    await gps(7.894, -72.5079);
    expect(calcular.pedidos).toEqual([
      {
        asignacionId: 'a1',
        motivo: 'sin_ruta',
        origen: { latitud: 7.8939, longitud: -72.5078 },
      },
    ]);
  });

  it('una ambulancia libre (sin servicio) no tiene ruta', async () => {
    await gps(7.8939, -72.5078, null);
    expect(calcular.pedidos).toHaveLength(0);
  });
});
