import { AmbulanciasMemoria } from '../../../../../../test/dobles/ambulancias_memoria.js';
import { AsignacionesMemoria } from '../../../../../../test/dobles/asignaciones_memoria.js';
import {
  EmergenciasMemoria,
  crearEmergenciaPrueba,
} from '../../../../../../test/dobles/emergencias_memoria.js';
import {
  RutasMemoria,
  crearRutaPrueba,
} from '../../../../../../test/dobles/rutas_memoria.js';
import { TurnosMemoria } from '../../../../../../test/dobles/turnos_memoria.js';
import { RecursoNoEncontradoError } from '../../../../../common/exceptions/errores_dominio.js';
import { Ambulancia } from '../../../../ambulances/domain/entities/ambulancia.entity.js';
import { Asignacion } from '../../../../assignments/domain/entities/asignacion.entity.js';
import type { Emergencia } from '../../../../emergencies/domain/entities/emergencia.entity.js';
import { ObtenerRutaAsignacion } from '../../../../routing/application/use-cases/obtener_ruta_asignacion.use-case.js';
import { ConsultarMisEmergencias } from '../../../application/use-cases/consultar_mis_emergencias.use-case.js';
import { ObtenerSeguimientoEmergencia } from '../../../application/use-cases/obtener_seguimiento_emergencia.use-case.js';

const CIUDADANO = 'ciudadano-1';
const MINUTO = 60_000;

describe('ObtenerSeguimientoEmergencia', () => {
  let ambulancias: AmbulanciasMemoria;
  let emergencias: EmergenciasMemoria;
  let asignaciones: AsignacionesMemoria;
  let rutas: RutasMemoria;
  let seguimiento: ObtenerSeguimientoEmergencia;

  beforeEach(() => {
    ambulancias = new AmbulanciasMemoria();
    emergencias = new EmergenciasMemoria();
    asignaciones = new AsignacionesMemoria(ambulancias, emergencias);
    rutas = new RutasMemoria();
    seguimiento = new ObtenerSeguimientoEmergencia(
      new ConsultarMisEmergencias(emergencias),
      asignaciones,
      ambulancias,
      new ObtenerRutaAsignacion(rutas, asignaciones, new TurnosMemoria()),
    );
  });

  async function reporte(informante = CIUDADANO): Promise<Emergencia> {
    return emergencias.crear(
      crearEmergenciaPrueba({
        fuente: 'app',
        informanteUsuarioId: informante,
        recibidaPorId: null,
        latitud: 7.907,
        longitud: -72.497,
      }),
    );
  }

  async function ambulanciaEn(haceMs: number | null): Promise<Ambulancia> {
    return ambulancias.crear(
      Ambulancia.reconstruir({
        id: crypto.randomUUID(),
        codigo: 'AMB-07',
        placa: 'XYZ987',
        tipo: { id: 't1', nombre: 'TAB', descripcion: null },
        estadoOperativo: 'en_servicio',
        ultimaUbicacion:
          haceMs === null
            ? null
            : {
                latitud: 7.8939,
                longitud: -72.5078,
                registradaEn: new Date(Date.now() - haceMs),
              },
        creadaEn: new Date(),
      }),
    );
  }

  function despachar(emergencia: Emergencia, ambulancia: Ambulancia) {
    emergencia.despachar();
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

  it('sin ambulancia despachada: no disponible, para seguir esperando', async () => {
    const emergencia = await reporte();

    const resultado = await seguimiento.ejecutar(CIUDADANO, emergencia.id);

    expect(resultado.disponible).toBe(false);
    expect(resultado.motivoNoDisponible).toBe('sin_ambulancia_asignada');
    expect(resultado.ambulancias).toEqual([]);
  });

  it('en camino: posición reciente y llegada estimada hasta el lugar del reporte', async () => {
    const emergencia = await reporte();
    const asignacion = despachar(emergencia, await ambulanciaEn(MINUTO / 2));
    asignacion.avanzar('en_camino', new Date());
    await rutas.guardar(crearRutaPrueba(asignacion.id));

    const resultado = await seguimiento.ejecutar(CIUDADANO, emergencia.id);

    expect(resultado.disponible).toBe(true);
    const [ambulancia] = resultado.ambulancias;
    expect(ambulancia).toEqual(
      expect.objectContaining({
        ambulanciaCodigo: null,
        tipoAmbulancia: 'TAB',
        etapa: 'en_camino',
      }),
    );
    expect(ambulancia?.ubicacion?.desactualizada).toBe(false);
    expect(ambulancia?.llegada?.distanciaMetros).toBe(2532);
  });

  it('una posición de más de 2 minutos se marca desactualizada; de más de 10 no se muestra', async () => {
    const vieja = await reporte();
    despachar(vieja, await ambulanciaEn(3 * MINUTO));
    const perdida = await reporte();
    despachar(perdida, await ambulanciaEn(11 * MINUTO));

    const conPuntoViejo = await seguimiento.ejecutar(CIUDADANO, vieja.id);
    const sinPunto = await seguimiento.ejecutar(CIUDADANO, perdida.id);

    expect(conPuntoViejo.ambulancias[0]?.ubicacion?.desactualizada).toBe(true);
    expect(sinPunto.ambulancias[0]?.ubicacion).toBeNull();
    expect(sinPunto.disponible).toBe(true);
  });

  it.each(['en_escena', 'atendiendo', 'trasladando'] as const)(
    'cuando la ambulancia llega al lugar (%s), el seguimiento termina',
    async (etapaFinal) => {
      const emergencia = await reporte();
      const asignacion = despachar(emergencia, await ambulanciaEn(10_000));
      const pasos = [
        'en_camino',
        'en_escena',
        'atendiendo',
        'trasladando',
      ] as const;
      for (const paso of pasos.slice(0, pasos.indexOf(etapaFinal) + 1)) {
        asignacion.avanzar(paso, new Date());
      }
      emergencia.iniciarAtencion();

      const resultado = await seguimiento.ejecutar(CIUDADANO, emergencia.id);

      expect(resultado.disponible).toBe(false);
      expect(resultado.motivoNoDisponible).toBe('ambulancia_en_el_lugar');
      expect(resultado.ambulancias).toEqual([]);
    },
  );

  it('al entregar al paciente y cerrarse la emergencia, el seguimiento termina', async () => {
    const emergencia = await reporte();
    const asignacion = despachar(emergencia, await ambulanciaEn(10_000));
    for (const paso of [
      'en_camino',
      'en_escena',
      'atendiendo',
      'trasladando',
      'finalizada',
    ] as const) {
      asignacion.avanzar(paso, new Date());
    }
    emergencia.iniciarAtencion();
    emergencia.cerrar(new Date());

    const resultado = await seguimiento.ejecutar(CIUDADANO, emergencia.id);

    expect(resultado.disponible).toBe(false);
    expect(resultado.motivoNoDisponible).toBe('finalizado');
    expect(resultado.ambulancias).toEqual([]);
  });

  it('el reporte de otro ciudadano responde 404', async () => {
    const ajena = await reporte('otro-ciudadano');
    await expect(seguimiento.ejecutar(CIUDADANO, ajena.id)).rejects.toThrow(
      RecursoNoEncontradoError,
    );
  });
});
