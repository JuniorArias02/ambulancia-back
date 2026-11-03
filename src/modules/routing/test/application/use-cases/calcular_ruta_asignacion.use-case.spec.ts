import {
  AmbulanciasMemoria,
  crearAmbulanciaPrueba,
} from '../../../../../../test/dobles/ambulancias_memoria.js';
import { AsignacionesMemoria } from '../../../../../../test/dobles/asignaciones_memoria.js';
import {
  EmergenciasMemoria,
  crearEmergenciaPrueba,
} from '../../../../../../test/dobles/emergencias_memoria.js';
import { PublicadorEventosMemoria } from '../../../../../../test/dobles/publicador_eventos_memoria.js';
import {
  ProveedorRutasFalso,
  ProveedoresRutasFijos,
  RutasMemoria,
} from '../../../../../../test/dobles/rutas_memoria.js';
import { FallaProveedorExterno } from '../../../../../common/exceptions/falla_proveedor_externo.js';
import { Ambulancia } from '../../../../ambulances/domain/entities/ambulancia.entity.js';
import { Asignacion } from '../../../../assignments/domain/entities/asignacion.entity.js';
import { CalcularRutaAsignacion } from '../../../application/use-cases/calcular_ruta_asignacion.use-case.js';

describe('CalcularRutaAsignacion', () => {
  const cucuta = { latitud: 7.8939, longitud: -72.5078 };
  let ambulancias: AmbulanciasMemoria;
  let emergencias: EmergenciasMemoria;
  let asignaciones: AsignacionesMemoria;
  let rutas: RutasMemoria;
  let eventos: PublicadorEventosMemoria;
  let proveedor: ProveedorRutasFalso;

  function crearCasoDeUso(proveedores = [proveedor]) {
    return new CalcularRutaAsignacion(
      rutas,
      asignaciones,
      emergencias,
      ambulancias,
      new ProveedoresRutasFijos(proveedores),
      eventos,
    );
  }

  async function servicio(ubicacionEn: Date | null = new Date()) {
    const base = crearAmbulanciaPrueba();
    const ambulancia = Ambulancia.reconstruir({
      id: base.id,
      codigo: base.codigo,
      placa: base.placa,
      tipo: base.tipo,
      estadoOperativo: 'en_servicio',
      ultimaUbicacion: ubicacionEn
        ? { ...cucuta, registradaEn: ubicacionEn }
        : null,
      creadaEn: base.creadaEn,
    });
    await ambulancias.crear(ambulancia);
    const emergencia = await emergencias.crear(
      crearEmergenciaPrueba({ latitud: 7.907, longitud: -72.497 }),
    );
    const asignacion = Asignacion.crear({
      emergenciaId: emergencia.id,
      ambulanciaId: ambulancia.id,
      turnoId: 't1',
      asignadaPorId: 'despachador-1',
      asignadaEn: new Date(),
    });
    asignaciones.asignaciones.set(asignacion.id, asignacion);
    return asignacion;
  }

  beforeEach(() => {
    ambulancias = new AmbulanciasMemoria();
    emergencias = new EmergenciasMemoria();
    asignaciones = new AsignacionesMemoria(ambulancias, emergencias);
    rutas = new RutasMemoria();
    eventos = new PublicadorEventosMemoria();
    proveedor = new ProveedorRutasFalso();
  });

  it('al despachar calcula desde la última posición reciente, guarda y avisa', async () => {
    const asignacion = await servicio();

    const ruta = await crearCasoDeUso().ejecutar({
      asignacionId: asignacion.id,
      motivo: 'despacho',
    });

    expect(ruta?.origen).toEqual(cucuta);
    expect(ruta?.destino).toEqual({ latitud: 7.907, longitud: -72.497 });
    expect(ruta?.distanciaMetros).toBe(2532);
    expect(rutas.rutas).toHaveLength(1);
    expect(eventos.eventos).toContainEqual({
      tipo: 'asignacion.ruta_actualizada',
      asignacionId: asignacion.id,
    });
  });

  it('no usa una posición vieja como origen (el caso Bogotá/Cúcuta)', async () => {
    const asignacion = await servicio(
      new Date(Date.now() - 3 * 60 * 60 * 1000),
    );

    const ruta = await crearCasoDeUso().ejecutar({
      asignacionId: asignacion.id,
      motivo: 'despacho',
    });

    expect(ruta).toBeNull();
    expect(proveedor.llamadas).toHaveLength(0);
  });

  it('con la posición recién reportada sí calcula', async () => {
    const asignacion = await servicio(null);

    const ruta = await crearCasoDeUso().ejecutar({
      asignacionId: asignacion.id,
      motivo: 'sin_ruta',
      origen: cucuta,
    });

    expect(ruta?.motivo).toBe('sin_ruta');
  });

  it('no calcula si la emergencia no tiene coordenadas', async () => {
    const asignacion = await servicio();
    const sinCoordenadas = await emergencias.crear(crearEmergenciaPrueba());
    const otra = Asignacion.crear({
      emergenciaId: sinCoordenadas.id,
      ambulanciaId: asignacion.ambulanciaId,
      turnoId: 't1',
      asignadaPorId: null,
      asignadaEn: new Date(),
    });
    asignaciones.asignaciones.set(otra.id, otra);

    expect(
      await crearCasoDeUso().ejecutar({
        asignacionId: otra.id,
        motivo: 'despacho',
      }),
    ).toBeNull();
  });

  it('no calcula si la ambulancia ya llegó a la escena', async () => {
    const asignacion = await servicio();
    asignacion.avanzar('en_camino', new Date());
    asignacion.avanzar('en_escena', new Date());

    expect(
      await crearCasoDeUso().ejecutar({
        asignacionId: asignacion.id,
        motivo: 'desvio',
        origen: cucuta,
      }),
    ).toBeNull();
  });

  it('si el proveedor falla, usa el respaldo; si todos fallan, no guarda nada', async () => {
    const asignacion = await servicio();
    proveedor.respuesta = () =>
      Promise.reject(
        new FallaProveedorExterno('falso', 'limite_excedido', '429'),
      );
    const respaldo = new ProveedorRutasFalso('respaldo');

    const conRespaldo = await crearCasoDeUso([proveedor, respaldo]).ejecutar({
      asignacionId: asignacion.id,
      motivo: 'despacho',
    });
    expect(conRespaldo?.proveedor).toBe('respaldo');

    const sinRespaldo = await crearCasoDeUso([proveedor]).ejecutar({
      asignacionId: asignacion.id,
      motivo: 'despacho',
    });
    expect(sinRespaldo).toBeNull();
    expect(rutas.rutas).toHaveLength(1);
  });

  it('dos disparos simultáneos para el mismo servicio calculan una sola vez', async () => {
    const asignacion = await servicio();
    const caso = crearCasoDeUso();

    await Promise.all([
      caso.ejecutar({ asignacionId: asignacion.id, motivo: 'despacho' }),
      caso.ejecutar({
        asignacionId: asignacion.id,
        motivo: 'sin_ruta',
        origen: cucuta,
      }),
    ]);

    expect(proveedor.llamadas).toHaveLength(1);
  });

  describe('hacia el hospital', () => {
    const hospital = { latitud: 7.91, longitud: -72.49 };

    function destino(institucionId: string, coordenadas = hospital) {
      return {
        institucionId,
        nombre: institucionId,
        direccion: null,
        telefono: null,
        coordenadas,
      };
    }

    async function enTraslado() {
      const asignacion = await servicio();
      asignacion.avanzar('en_camino', new Date());
      asignacion.avanzar('en_escena', new Date());
      asignacion.avanzar('atendiendo', new Date());
      asignacion.avanzar('trasladando', new Date());
      return asignacion;
    }

    it('sin hospital no calcula', async () => {
      const asignacion = await enTraslado();

      expect(
        await crearCasoDeUso().ejecutar({
          asignacionId: asignacion.id,
          motivo: 'inicio_traslado',
        }),
      ).toBeNull();
      expect(proveedor.llamadas).toHaveLength(0);
    });

    it('calcula desde la posición reciente hacia el hospital', async () => {
      const asignacion = await enTraslado();
      asignacion.definirDestino(destino('h1'), 'c1', new Date());

      const ruta = await crearCasoDeUso().ejecutar({
        asignacionId: asignacion.id,
        motivo: 'inicio_traslado',
      });

      expect(ruta?.tramo).toBe('hacia_destino');
      expect(ruta?.origen).toEqual(cucuta);
      expect(ruta?.destino).toEqual(hospital);
      expect(ruta?.esVigentePara(asignacion)).toBe(true);
    });

    it('con una posición vieja espera el siguiente GPS', async () => {
      const asignacion = await servicio(new Date(Date.now() - 11 * 60 * 1000));
      asignacion.avanzar('en_camino', new Date());
      asignacion.avanzar('en_escena', new Date());
      asignacion.avanzar('atendiendo', new Date());
      asignacion.avanzar('trasladando', new Date());
      asignacion.definirDestino(destino('h1'), 'c1', new Date());

      expect(
        await crearCasoDeUso().ejecutar({
          asignacionId: asignacion.id,
          motivo: 'inicio_traslado',
        }),
      ).toBeNull();
    });

    it('cambiar de hospital invalida la ruta anterior', async () => {
      const asignacion = await enTraslado();
      asignacion.definirDestino(destino('h1'), 'c1', new Date());
      const anterior = await crearCasoDeUso().ejecutar({
        asignacionId: asignacion.id,
        motivo: 'inicio_traslado',
      });

      asignacion.definirDestino(
        destino('h2', { latitud: 7.95, longitud: -72.4 }),
        'c1',
        new Date(Date.now() + 5),
      );

      expect(anterior?.esVigentePara(asignacion)).toBe(false);
    });

    it('volver a un hospital anterior tampoco reutiliza la ruta vieja', async () => {
      const asignacion = await enTraslado();
      asignacion.definirDestino(destino('h1'), 'c1', new Date());
      const anterior = await crearCasoDeUso().ejecutar({
        asignacionId: asignacion.id,
        motivo: 'inicio_traslado',
      });

      asignacion.definirDestino(destino('h1'), 'c1', new Date(Date.now() + 5));

      expect(anterior?.esVigentePara(asignacion)).toBe(false);
    });

    it('si el hospital cambia mientras responde el proveedor, descarta el resultado y no lo guarda', async () => {
      const asignacion = await enTraslado();
      asignacion.definirDestino(destino('h1'), 'c1', new Date());
      const responder = proveedor.respuesta;
      proveedor.respuesta = (origen, destinoPedido) => {
        asignacion.definirDestino(
          destino('h2', { latitud: 7.95, longitud: -72.4 }),
          'c1',
          new Date(Date.now() + 5),
        );
        return responder(origen, destinoPedido);
      };

      const ruta = await crearCasoDeUso().ejecutar({
        asignacionId: asignacion.id,
        motivo: 'inicio_traslado',
      });

      expect(ruta).toBeNull();
      expect(rutas.rutas).toHaveLength(0);
    });

    it('un cálculo en curso hacia otro hospital no absorbe el del destino nuevo', async () => {
      const asignacion = await enTraslado();
      asignacion.definirDestino(destino('h1'), 'c1', new Date());
      let soltar: () => void = () => undefined;
      const responder = proveedor.respuesta;
      proveedor.respuesta = async (origen, destinoPedido) => {
        await new Promise<void>((resolver) => {
          soltar = resolver;
        });
        proveedor.respuesta = responder;
        return responder(origen, destinoPedido);
      };
      const casoDeUso = crearCasoDeUso();

      const primero = casoDeUso.ejecutar({
        asignacionId: asignacion.id,
        motivo: 'inicio_traslado',
      });
      await new Promise((resolver) => setTimeout(resolver, 5));
      const nuevo = { latitud: 7.95, longitud: -72.4 };
      asignacion.definirDestino(destino('h2', nuevo), 'c1', new Date());
      proveedor.respuesta = responder;
      const segundo = await casoDeUso.ejecutar({
        asignacionId: asignacion.id,
        motivo: 'cambio_destino',
      });
      soltar();
      await primero;

      expect(segundo?.destino).toEqual(nuevo);
      expect(rutas.rutas.map((r) => r.destino)).toEqual([nuevo]);
    });
  });
});
