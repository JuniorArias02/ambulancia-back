import { AmbulanciasMemoria } from '../../../../../../test/dobles/ambulancias_memoria.js';
import { AsignacionesMemoria } from '../../../../../../test/dobles/asignaciones_memoria.js';
import {
  EmergenciasMemoria,
  crearEmergenciaPrueba,
} from '../../../../../../test/dobles/emergencias_memoria.js';
import { PublicadorEventosMemoria } from '../../../../../../test/dobles/publicador_eventos_memoria.js';
import {
  RutasMemoria,
  crearRutaPrueba,
} from '../../../../../../test/dobles/rutas_memoria.js';
import {
  TurnosMemoria,
  crearTurnoPrueba,
} from '../../../../../../test/dobles/turnos_memoria.js';
import { ObtenerAmbulancia } from '../../../../ambulances/application/use-cases/obtener_ambulancia.use-case.js';
import { ObtenerTurno } from '../../../../ambulances/application/use-cases/obtener_turno.use-case.js';
import { ConsultarAsignaciones } from '../../../../assignments/application/use-cases/consultar_asignaciones.use-case.js';
import { ObtenerAsignacion } from '../../../../assignments/application/use-cases/obtener_asignacion.use-case.js';
import { ObtenerMiServicio } from '../../../../assignments/application/use-cases/obtener_mi_servicio.use-case.js';
import { Asignacion } from '../../../../assignments/domain/entities/asignacion.entity.js';
import { BuscarPosiblesDuplicadas } from '../../../../emergencies/application/use-cases/buscar_posibles_duplicadas.use-case.js';
import { ObtenerEmergencia } from '../../../../emergencies/application/use-cases/obtener_emergencia.use-case.js';
import { ObtenerRutaAsignacion } from '../../../../routing/application/use-cases/obtener_ruta_asignacion.use-case.js';
import { LimitadorUbicaciones } from '../../../application/services/limitador_ubicaciones.js';
import { NotificadorTiempoReal } from '../../../presentation/listeners/notificador_tiempo_real.listener.js';
import { EmisorTiempoRealMemoria } from '../../dobles/emisor_tiempo_real_memoria.js';

describe('NotificadorTiempoReal', () => {
  const tripulacionA = [
    { usuarioId: 'conductor-a', funcion: 'conductor' as const },
    { usuarioId: 'paramedico-a', funcion: 'paramedico' as const },
  ];
  const tripulacionB = [
    { usuarioId: 'conductor-b', funcion: 'conductor' as const },
    { usuarioId: 'paramedico-b', funcion: 'paramedico' as const },
  ];
  let emergencias: EmergenciasMemoria;
  let turnos: TurnosMemoria;
  let asignaciones: AsignacionesMemoria;
  let emisor: EmisorTiempoRealMemoria;
  let rutas: RutasMemoria;
  let notificador: NotificadorTiempoReal;

  beforeEach(() => {
    const ambulancias = new AmbulanciasMemoria();
    emergencias = new EmergenciasMemoria();
    turnos = new TurnosMemoria();
    asignaciones = new AsignacionesMemoria(ambulancias, emergencias);
    emisor = new EmisorTiempoRealMemoria();
    rutas = new RutasMemoria();
    notificador = new NotificadorTiempoReal(
      new PublicadorEventosMemoria(),
      emisor,
      new LimitadorUbicaciones(),
      new ObtenerEmergencia(emergencias),
      new BuscarPosiblesDuplicadas(emergencias),
      new ObtenerAsignacion(asignaciones),
      new ConsultarAsignaciones(asignaciones),
      new ObtenerAmbulancia(ambulancias),
      new ObtenerTurno(turnos),
      new ObtenerMiServicio(turnos, asignaciones, emergencias, {
        radioLlegadaMetros: 100,
      }),
      new ObtenerRutaAsignacion(rutas, asignaciones, turnos),
    );
  });

  async function despachoDeTripulacionA() {
    const turno = await turnos.crear(crearTurnoPrueba('amb-a', tripulacionA));
    await turnos.crear(crearTurnoPrueba('amb-b', tripulacionB));
    const emergencia = await emergencias.crear(crearEmergenciaPrueba());
    const asignacion = Asignacion.crear({
      emergenciaId: emergencia.id,
      ambulanciaId: 'amb-a',
      turnoId: turno.id,
      asignadaPorId: 'despachador-1',
      asignadaEn: new Date(),
    });
    asignaciones.asignaciones.set(asignacion.id, asignacion);
    return { emergencia, asignacion };
  }

  it('la emergencia nueva va solo a la central', async () => {
    const emergencia = await emergencias.crear(crearEmergenciaPrueba());

    await notificador.notificar({
      tipo: 'emergencia.creada',
      emergenciaId: emergencia.id,
    });

    expect(emisor.emisiones).toEqual([
      expect.objectContaining({
        salas: ['central'],
        tipo: 'emergencia.creada',
      }),
    ]);
  });

  it('sugiere posibles duplicados a la central sin marcarlos', async () => {
    const primera = await emergencias.crear(crearEmergenciaPrueba());
    const segunda = await emergencias.crear(crearEmergenciaPrueba());

    await notificador.notificar({
      tipo: 'emergencia.creada',
      emergenciaId: segunda.id,
    });

    expect(emisor.recibidosPor('central')).toEqual([
      'emergencia.creada',
      'emergencia.posible_duplicado',
    ]);
    expect(primera.estado).toBe('recibida');
    expect(segunda.estado).toBe('recibida');
  });

  it('una asignación avisa a la central y solo a la tripulación asignada', async () => {
    const { asignacion } = await despachoDeTripulacionA();

    await notificador.notificar({
      tipo: 'asignacion.creada',
      asignacionId: asignacion.id,
    });

    expect(emisor.recibidosPor('central')).toEqual(['asignacion.creada']);
    expect(emisor.recibidosPor('usuario:conductor-a')).toEqual([
      'mi_servicio.actualizado',
    ]);
    expect(emisor.recibidosPor('usuario:paramedico-a')).toEqual([
      'mi_servicio.actualizado',
    ]);
    expect(emisor.recibidosPor('usuario:conductor-b')).toEqual([]);
    expect(emisor.recibidosPor('usuario:paramedico-b')).toEqual([]);
  });

  it('cada tripulante recibe su propio servicio, no la lista general', async () => {
    const { asignacion } = await despachoDeTripulacionA();

    await notificador.notificar({
      tipo: 'asignacion.creada',
      asignacionId: asignacion.id,
    });

    const servicio = emisor.emisiones.find((e) =>
      e.salas.includes('usuario:conductor-a'),
    );
    expect(servicio?.salas).toEqual(['usuario:conductor-a']);
    expect(servicio?.datos).toEqual(
      expect.objectContaining({
        asignacion: expect.objectContaining({ id: asignacion.id }),
      }),
    );
  });

  it('un cambio en la emergencia llega a la tripulación que la atiende', async () => {
    const { emergencia } = await despachoDeTripulacionA();

    await notificador.notificar({
      tipo: 'emergencia.actualizada',
      emergenciaId: emergencia.id,
      cambios: ['prioridad'],
    });

    expect(emisor.recibidosPor('central')).toEqual(['emergencia.actualizada']);
    expect(emisor.recibidosPor('usuario:conductor-a')).toEqual([
      'mi_servicio.actualizado',
    ]);
    expect(emisor.recibidosPor('usuario:conductor-b')).toEqual([]);
  });

  it('un cambio de turno avisa también a quien salió de él', async () => {
    const turno = await turnos.crear(crearTurnoPrueba('amb-a', tripulacionA));

    await notificador.notificar({
      tipo: 'turno.actualizado',
      turnoId: turno.id,
      usuariosAfectados: ['conductor-a', 'paramedico-a', 'conductor-saliente'],
    });

    expect(emisor.recibidosPor('central')).toEqual(['turno.actualizado']);
    const saliente = emisor.emisiones.find((e) =>
      e.salas.includes('usuario:conductor-saliente'),
    );
    expect(saliente?.datos).toEqual(expect.objectContaining({ turno: null }));
  });

  it('limita las ubicaciones de una misma ambulancia', async () => {
    const ubicacion = {
      tipo: 'ambulancia.ubicacion_actualizada' as const,
      ambulanciaId: 'amb-a',
      asignacionId: null,
      latitud: 4.65,
      longitud: -74.05,
      velocidad: null,
      registradaEn: new Date(),
    };

    await notificador.notificar(ubicacion);
    await notificador.notificar(ubicacion);
    await notificador.notificar({ ...ubicacion, ambulanciaId: 'amb-b' });

    expect(emisor.emisiones.map((e) => e.salas)).toEqual([
      ['central'],
      ['central'],
    ]);
    expect(emisor.emisiones[0]?.datos).not.toHaveProperty('tipo');
  });

  it('la ruta nueva va a la central y solo a la tripulación de ese servicio', async () => {
    const { asignacion } = await despachoDeTripulacionA();
    await rutas.guardar(crearRutaPrueba(asignacion.id));

    await notificador.notificar({
      tipo: 'asignacion.ruta_actualizada',
      asignacionId: asignacion.id,
    });

    expect(emisor.emisiones).toHaveLength(1);
    const [envio] = emisor.emisiones;
    expect(envio?.tipo).toBe('asignacion.ruta_actualizada');
    expect(envio?.salas).toEqual(
      expect.arrayContaining([
        'central',
        'usuario:conductor-a',
        'usuario:paramedico-a',
      ]),
    );
    expect(envio?.salas).not.toEqual(
      expect.arrayContaining(['usuario:conductor-b']),
    );
  });
});
