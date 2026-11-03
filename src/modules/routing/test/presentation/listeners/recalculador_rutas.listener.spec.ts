import { PublicadorEventosMemoria } from '../../../../../../test/dobles/publicador_eventos_memoria.js';
import {
  RutasMemoria,
  crearRutaPrueba,
} from '../../../../../../test/dobles/rutas_memoria.js';
import {
  Asignacion,
  type EstadoAsignacion,
} from '../../../../assignments/domain/entities/asignacion.entity.js';
import type { AsignacionesRepositorio } from '../../../../assignments/domain/repositories/asignaciones.repository.js';
import type { CalcularRutaEntrada } from '../../../application/use-cases/calcular_ruta_asignacion.use-case.js';
import { CalcularRutaAsignacion } from '../../../application/use-cases/calcular_ruta_asignacion.use-case.js';
import { RutaAsignacion } from '../../../domain/entities/ruta_asignacion.entity.js';
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

const HOSPITAL = { latitud: 7.91, longitud: -72.49 };

function crearServicio(
  estado: EstadoAsignacion,
  cambios: {
    destino?: boolean;
    destinoActualizadoEn?: Date;
    salidaEscenaEn?: Date;
  } = {},
): Asignacion {
  return Asignacion.reconstruir({
    id: 'a1',
    emergenciaId: 'e1',
    ambulanciaId: 'amb-1',
    turnoId: 't1',
    asignadaPorId: null,
    estado,
    motivoCancelacion: null,
    asignadaEn: new Date(),
    salidaEn: null,
    llegadaEscenaEn: null,
    atencionInicioEn: null,
    salidaEscenaEn: cambios.salidaEscenaEn ?? null,
    llegadaDestinoEn: null,
    finalizadaEn: null,
    destino: cambios.destino
      ? {
          institucionId: 'i1',
          nombre: 'Hospital',
          direccion: null,
          telefono: null,
          coordenadas: HOSPITAL,
        }
      : null,
    destinoActualizadoPorId: cambios.destino ? 'c1' : null,
    destinoActualizadoEn: cambios.destinoActualizadoEn ?? null,
    destinoActualizadoPorNombre: null,
    numeroEmergencia: null,
    ambulanciaCodigo: null,
    asignadaPorNombre: null,
  });
}

describe('RecalculadorRutas', () => {
  const configuracion = {
    distanciaDesvioMetros: 150,
    intervaloRecalculoMs: 60_000,
  };
  const servicios = new Map<string, Asignacion>();
  const asignaciones = {
    buscarPorId: (id: string) => Promise.resolve(servicios.get(id) ?? null),
  } as unknown as AsignacionesRepositorio;
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
    servicios.clear();
    servicios.set('a1', crearServicio('en_camino'));
    rutas = new RutasMemoria();
    calcular = new CalcularRutaEspia();
    recalculador = new RecalculadorRutas(
      new PublicadorEventosMemoria(),
      calcular as unknown as CalcularRutaAsignacion,
      rutas,
      asignaciones,
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

  describe('traslado al hospital', () => {
    const haceUnMinuto = new Date(Date.now() - 60_000);
    const actualizado = () =>
      recalculador.alOcurrir({
        tipo: 'asignacion.actualizada',
        asignacionId: 'a1',
      });

    it('al subir al paciente con hospital elegido, calcula', async () => {
      servicios.set(
        'a1',
        crearServicio('trasladando', {
          destino: true,
          destinoActualizadoEn: new Date(haceUnMinuto.getTime() - 1000),
          salidaEscenaEn: haceUnMinuto,
        }),
      );
      await actualizado();
      expect(calcular.pedidos).toEqual([
        { asignacionId: 'a1', motivo: 'inicio_traslado' },
      ]);
    });

    it('sin hospital no calcula: el traslado no lo exige', async () => {
      servicios.set(
        'a1',
        crearServicio('trasladando', { salidaEscenaEn: haceUnMinuto }),
      );
      await actualizado();
      await gps(7.9, -72.5);
      expect(calcular.pedidos).toEqual([]);
    });

    it('elegir el hospital durante el traslado recalcula, aunque la ruta anterior vaya a otro lugar', async () => {
      await rutas.guardar(crearRutaPrueba('a1'));
      servicios.set(
        'a1',
        crearServicio('trasladando', {
          destino: true,
          destinoActualizadoEn: new Date(),
          salidaEscenaEn: haceUnMinuto,
        }),
      );
      await actualizado();
      expect(calcular.pedidos).toEqual([
        { asignacionId: 'a1', motivo: 'cambio_destino' },
      ]);
    });

    it('otro cambio del servicio con ruta vigente no recalcula', async () => {
      const elegidoEn = new Date(Date.now() - 10_000);
      servicios.set(
        'a1',
        crearServicio('trasladando', {
          destino: true,
          destinoActualizadoEn: elegidoEn,
          salidaEscenaEn: haceUnMinuto,
        }),
      );
      await rutas.guardar(
        RutaAsignacion.calcular({
          asignacionId: 'a1',
          tramo: 'hacia_destino',
          motivo: 'cambio_destino',
          origen: HOSPITAL,
          destino: HOSPITAL,
          ruta: {
            geometria: [HOSPITAL, HOSPITAL],
            distanciaMetros: 1,
            duracionSegundos: 1,
          },
          proveedor: 'falso',
          calculadaEn: new Date(),
        }),
      );
      await actualizado();
      expect(calcular.pedidos).toHaveLength(0);
    });

    it('los GPS sin hospital no retrasan el cálculo de cuando se elija', async () => {
      servicios.set(
        'a1',
        crearServicio('trasladando', { salidaEscenaEn: haceUnMinuto }),
      );
      await gps(7.9, -72.5);
      servicios.set(
        'a1',
        crearServicio('trasladando', {
          destino: true,
          destinoActualizadoEn: new Date(),
          salidaEscenaEn: haceUnMinuto,
        }),
      );
      await gps(7.905, -72.499);
      expect(calcular.pedidos).toEqual([
        {
          asignacionId: 'a1',
          motivo: 'sin_ruta',
          origen: { latitud: 7.905, longitud: -72.499 },
        },
      ]);
    });

    it('elegir otro hospital libera los intentos fallidos del anterior', async () => {
      servicios.set(
        'a1',
        crearServicio('trasladando', {
          destino: true,
          destinoActualizadoEn: new Date(),
          salidaEscenaEn: haceUnMinuto,
        }),
      );
      await gps(7.9, -72.5);
      await actualizado();
      await gps(7.905, -72.499);
      expect(calcular.pedidos.map((p) => p.motivo)).toEqual([
        'sin_ruta',
        'cambio_destino',
        'sin_ruta',
      ]);
    });

    it('en la escena el GPS no calcula nada', async () => {
      servicios.set('a1', crearServicio('atendiendo'));
      await gps(7.9, -72.5);
      expect(calcular.pedidos).toHaveLength(0);
    });
  });

  it('una ambulancia libre (sin servicio) no tiene ruta', async () => {
    await gps(7.8939, -72.5078, null);
    expect(calcular.pedidos).toHaveLength(0);
  });
});
