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
import { AuditoriaMemoria } from '../../../../../../test/dobles/repositorios_memoria.js';
import {
  TurnosMemoria,
  crearTurnoPrueba,
} from '../../../../../../test/dobles/turnos_memoria.js';
import {
  Roles,
  type NombreRol,
} from '../../../../../common/constants/roles.js';
import {
  AccesoDenegadoError,
  ReglaNegocioError,
} from '../../../../../common/exceptions/errores_dominio.js';
import { Ambulancia } from '../../../../ambulances/domain/entities/ambulancia.entity.js';
import { PermisoServicio } from '../../../application/services/permiso_servicio.service.js';
import {
  AvanzarAsignacion,
  type AvanzarAsignacionEntrada,
} from '../../../application/use-cases/avanzar_asignacion.use-case.js';
import { CancelarAsignacion } from '../../../application/use-cases/cancelar_asignacion.use-case.js';
import { DespacharAmbulancia } from '../../../application/use-cases/despachar_ambulancia.use-case.js';
import type { EstadoAvance } from '../../../domain/entities/asignacion.entity.js';

/** Emergencia en Cúcuta y posiciones a ~50 m y ~1 km de ella. */
const ESCENA = { latitud: 7.907, longitud: -72.497 };
const A_50_METROS = { latitud: 7.90745, longitud: -72.497 };
const A_1_KM = { latitud: 7.916, longitud: -72.497 };

describe('Flujo de asignación y ciclo de atención', () => {
  const despachador = {
    usuarioId: 'despachador-1',
    direccionIp: null,
    rol: Roles.DESPACHADOR,
  };
  const conductor = {
    usuarioId: 'conductor-1',
    direccionIp: null,
    rol: Roles.CONDUCTOR,
  };
  const paramedico = {
    usuarioId: 'paramedico-1',
    direccionIp: null,
    rol: Roles.PARAMEDICO,
  };
  let ambulancias: AmbulanciasMemoria;
  let emergencias: EmergenciasMemoria;
  let turnos: TurnosMemoria;
  let asignaciones: AsignacionesMemoria;
  let eventos: PublicadorEventosMemoria;
  let despachar: DespacharAmbulancia;
  let avanzar: AvanzarAsignacion;
  let cancelar: CancelarAsignacion;

  beforeEach(() => {
    ambulancias = new AmbulanciasMemoria();
    emergencias = new EmergenciasMemoria();
    turnos = new TurnosMemoria();
    asignaciones = new AsignacionesMemoria(ambulancias, emergencias);
    const auditoria = new AuditoriaMemoria();
    eventos = new PublicadorEventosMemoria();
    despachar = new DespacharAmbulancia(
      asignaciones,
      emergencias,
      ambulancias,
      turnos,
      auditoria,
      eventos,
    );
    avanzar = new AvanzarAsignacion(
      asignaciones,
      emergencias,
      ambulancias,
      new PermisoServicio(turnos),
      { radioLlegadaMetros: 100 },
      auditoria,
      eventos,
    );
    cancelar = new CancelarAsignacion(
      asignaciones,
      emergencias,
      ambulancias,
      auditoria,
      eventos,
    );
  });

  async function ambulanciaDisponibleConTurno(codigo = 'amb-01') {
    const base = crearAmbulanciaPrueba({ codigo, placa: `${codigo}x` });
    const ambulancia = Ambulancia.reconstruir({
      id: base.id,
      codigo: base.codigo,
      placa: base.placa,
      tipo: base.tipo,
      estadoOperativo: 'disponible',
      ultimaUbicacion: null,
      creadaEn: base.creadaEn,
    });
    await ambulancias.crear(ambulancia);
    await turnos.crear(crearTurnoPrueba(ambulancia.id));
    return ambulancia;
  }

  async function servicioDespachado() {
    const ambulancia = await ambulanciaDisponibleConTurno();
    const emergencia = await emergencias.crear(crearEmergenciaPrueba(ESCENA));
    const asignacion = await despachar.ejecutar(
      { emergenciaId: emergencia.id, ambulanciaId: ambulancia.id },
      despachador,
    );
    return { ambulancia, emergencia, asignacion };
  }

  function paso(
    asignacionId: string,
    estado: EstadoAvance,
    quien: { usuarioId: string; direccionIp: null; rol: NombreRol },
    extras: Partial<AvanzarAsignacionEntrada> = {},
  ) {
    return avanzar.ejecutar(
      { asignacionId, estado, rolSolicitante: quien.rol, ...extras },
      quien,
    );
  }

  /** Llegada confirmada por el conductor junto a la emergencia. */
  function llegar(asignacionId: string) {
    return paso(asignacionId, 'en_escena', conductor, {
      posicion: A_50_METROS,
      precisionMetros: 8,
    });
  }

  it('recorre el ciclo completo con traslado y registra cada paso con su responsable', async () => {
    const { ambulancia, emergencia, asignacion } = await servicioDespachado();

    await paso(asignacion.id, 'en_camino', conductor);
    await llegar(asignacion.id);
    await paso(asignacion.id, 'atendiendo', paramedico);
    await paso(asignacion.id, 'trasladando', paramedico);
    await paso(asignacion.id, 'finalizada', conductor);

    expect(asignacion.estado).toBe('finalizada');
    expect(asignacion.atencionInicioEn).not.toBeNull();
    expect(asignacion.llegadaDestinoEn).not.toBeNull();
    expect(ambulancia.estadoOperativo).toBe('disponible');
    expect(emergencia.estado).toBe('cerrada');

    const linea = await asignaciones.listarEventos(asignacion.id);
    expect(
      linea.map((e) => [e.estadoNuevo, e.usuarioId, e.rolResponsable]),
    ).toEqual([
      ['asignada', 'despachador-1', 'despachador'],
      ['en_camino', 'conductor-1', 'conductor'],
      ['en_escena', 'conductor-1', 'conductor'],
      ['atendiendo', 'paramedico-1', 'paramedico'],
      ['trasladando', 'paramedico-1', 'paramedico'],
      ['finalizada', 'conductor-1', 'conductor'],
    ]);
    const llegada = linea[2];
    expect(llegada?.posicion).toEqual(A_50_METROS);
    expect(llegada?.distanciaEscenaMetros).toBeGreaterThan(40);
    expect(llegada?.distanciaEscenaMetros).toBeLessThan(60);
    expect(llegada?.fueraDeRadio).toBe(false);
  });

  it('publica los cambios de asignación, ambulancia y emergencia de cada paso', async () => {
    const { asignacion } = await servicioDespachado();
    expect(eventos.tipos()).toEqual([
      'asignacion.creada',
      'ambulancia.actualizada',
      'emergencia.actualizada',
    ]);

    eventos.eventos.length = 0;
    await paso(asignacion.id, 'en_camino', despachador);
    // En camino no cambia ni la ambulancia ni la emergencia.
    expect(eventos.tipos()).toEqual(['asignacion.actualizada']);

    eventos.eventos.length = 0;
    await llegar(asignacion.id);
    await paso(asignacion.id, 'finalizada', despachador, {
      observacion: 'Paciente atendido en el sitio',
    });
    expect(eventos.tipos()).toEqual([
      'asignacion.actualizada',
      'emergencia.actualizada',
      'asignacion.actualizada',
      'ambulancia.actualizada',
      'emergencia.actualizada',
    ]);
  });

  describe('llegada a la escena', () => {
    it('solo la confirma el conductor del turno', async () => {
      const { asignacion } = await servicioDespachado();
      await paso(asignacion.id, 'en_camino', conductor);

      for (const quien of [paramedico, despachador]) {
        await expect(
          paso(asignacion.id, 'en_escena', quien, { posicion: A_50_METROS }),
        ).rejects.toThrow(AccesoDenegadoError);
      }
      expect(asignacion.estado).toBe('en_camino');
    });

    it('exige el GPS del celular', async () => {
      const { asignacion } = await servicioDespachado();
      await paso(asignacion.id, 'en_camino', conductor);

      await expect(paso(asignacion.id, 'en_escena', conductor)).rejects.toThrow(
        'Envíe la ubicación GPS',
      );
    });

    it('fuera del radio se rechaza con la distancia; no se confirma sola', async () => {
      const { asignacion } = await servicioDespachado();
      await paso(asignacion.id, 'en_camino', conductor);

      await expect(
        paso(asignacion.id, 'en_escena', conductor, { posicion: A_1_KM }),
      ).rejects.toThrow(/Está a 1001 m de la emergencia \(radio de 100 m\)/);
      // Confirmar sin explicar el motivo tampoco basta.
      await expect(
        paso(asignacion.id, 'en_escena', conductor, {
          posicion: A_1_KM,
          confirmarFueraDeRadio: true,
        }),
      ).rejects.toThrow(ReglaNegocioError);
      expect(asignacion.estado).toBe('en_camino');
    });

    it('fuera del radio, el conductor puede confirmar justificándolo y queda marcado', async () => {
      const { asignacion } = await servicioDespachado();
      await paso(asignacion.id, 'en_camino', conductor);

      await paso(asignacion.id, 'en_escena', conductor, {
        posicion: A_1_KM,
        confirmarFueraDeRadio: true,
        observacion:
          'La dirección registrada estaba equivocada; el paciente está aquí',
      });

      const llegada = (await asignaciones.listarEventos(asignacion.id)).at(-1);
      expect(llegada?.fueraDeRadio).toBe(true);
      expect(llegada?.observacion).toContain('equivocada');
    });

    it('si la emergencia no tiene coordenadas, se acepta sin distancia', async () => {
      const ambulancia = await ambulanciaDisponibleConTurno();
      const sinCoordenadas = await emergencias.crear(crearEmergenciaPrueba());
      const asignacion = await despachar.ejecutar(
        { emergenciaId: sinCoordenadas.id, ambulanciaId: ambulancia.id },
        despachador,
      );
      await paso(asignacion.id, 'en_camino', conductor);

      await paso(asignacion.id, 'en_escena', conductor, { posicion: A_1_KM });

      const llegada = (await asignaciones.listarEventos(asignacion.id)).at(-1);
      expect(llegada?.distanciaEscenaMetros).toBeNull();
    });
  });

  it('cerrar sin trasladar exige explicar por qué', async () => {
    const { asignacion } = await servicioDespachado();
    await paso(asignacion.id, 'en_camino', conductor);
    await llegar(asignacion.id);
    await paso(asignacion.id, 'atendiendo', paramedico);

    await expect(paso(asignacion.id, 'finalizada', paramedico)).rejects.toThrow(
      'sin trasladar',
    );
    await paso(asignacion.id, 'finalizada', paramedico, {
      observacion: 'Paciente rechaza el traslado; firma el desistimiento',
    });
    expect(asignacion.estado).toBe('finalizada');
  });

  it('repetir un paso ya hecho no duplica el registro ni los avisos', async () => {
    const { asignacion } = await servicioDespachado();
    await paso(asignacion.id, 'en_camino', conductor);
    eventos.eventos.length = 0;

    const repetido = await paso(asignacion.id, 'en_camino', conductor);

    expect(repetido.estado).toBe('en_camino');
    expect(eventos.eventos).toHaveLength(0);
    const enCamino = (await asignaciones.listarEventos(asignacion.id)).filter(
      (e) => e.estadoNuevo === 'en_camino',
    );
    expect(enCamino).toHaveLength(1);
  });

  it('no deja saltarse pasos del ciclo', async () => {
    const { asignacion } = await servicioDespachado();
    await paso(asignacion.id, 'en_camino', conductor);

    await expect(paso(asignacion.id, 'atendiendo', paramedico)).rejects.toThrow(
      'No se puede pasar de en_camino a atendiendo',
    );
  });

  it('no despacha una ambulancia que no está disponible', async () => {
    const ambulancia = await ambulanciaDisponibleConTurno();
    const primera = await emergencias.crear(crearEmergenciaPrueba());
    const segunda = await emergencias.crear(crearEmergenciaPrueba());
    await despachar.ejecutar(
      { emergenciaId: primera.id, ambulanciaId: ambulancia.id },
      despachador,
    );
    eventos.eventos.length = 0;

    await expect(
      despachar.ejecutar(
        { emergenciaId: segunda.id, ambulanciaId: ambulancia.id },
        despachador,
      ),
    ).rejects.toThrow(ReglaNegocioError);
    expect(eventos.eventos).toHaveLength(0);
  });

  it('la emergencia sigue abierta mientras otra ambulancia la atienda', async () => {
    const a1 = await ambulanciaDisponibleConTurno('amb-01');
    const a2 = Ambulancia.reconstruir({
      id: 'a2',
      codigo: 'AMB-02',
      placa: 'XYZ987',
      tipo: a1.tipo,
      estadoOperativo: 'disponible',
      ultimaUbicacion: null,
      creadaEn: new Date(),
    });
    await ambulancias.crear(a2);
    await turnos.crear(
      crearTurnoPrueba(a2.id, [
        { usuarioId: 'conductor-2', funcion: 'conductor' },
        { usuarioId: 'paramedico-2', funcion: 'paramedico' },
      ]),
    );
    const emergencia = await emergencias.crear(crearEmergenciaPrueba(ESCENA));

    const s1 = await despachar.ejecutar(
      { emergenciaId: emergencia.id, ambulanciaId: a1.id },
      despachador,
    );
    await despachar.ejecutar(
      { emergenciaId: emergencia.id, ambulanciaId: a2.id },
      despachador,
    );
    await paso(s1.id, 'en_camino', despachador);
    await llegar(s1.id);
    await paso(s1.id, 'finalizada', despachador, {
      observacion: 'Sin paciente en el lugar',
    });

    expect(emergencia.estado).toBe('en_atencion');
  });

  it('solo la tripulación del turno puede marcar el avance', async () => {
    const { asignacion } = await servicioDespachado();

    await expect(
      paso(asignacion.id, 'en_camino', {
        usuarioId: 'otro-paramedico',
        direccionIp: null,
        rol: Roles.PARAMEDICO,
      }),
    ).rejects.toThrow(AccesoDenegadoError);
  });

  it('al cancelar la única asignación, la emergencia vuelve a recibida y queda el motivo', async () => {
    const { ambulancia, emergencia, asignacion } = await servicioDespachado();

    await cancelar.ejecutar(
      { asignacionId: asignacion.id, motivo: 'Se envía una más cercana' },
      despachador,
    );

    expect(asignacion.estado).toBe('cancelada');
    expect(ambulancia.estadoOperativo).toBe('disponible');
    expect(emergencia.estado).toBe('recibida');
    const cancelacion = (await asignaciones.listarEventos(asignacion.id)).at(
      -1,
    );
    expect(cancelacion).toMatchObject({
      estadoNuevo: 'cancelada',
      usuarioId: 'despachador-1',
      rolResponsable: 'despachador',
      observacion: 'Se envía una más cercana',
    });
  });
});
