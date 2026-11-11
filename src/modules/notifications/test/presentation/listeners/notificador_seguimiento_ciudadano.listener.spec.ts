import { AmbulanciasMemoria } from '../../../../../../test/dobles/ambulancias_memoria.js';
import { AsignacionesMemoria } from '../../../../../../test/dobles/asignaciones_memoria.js';
import {
  EmergenciasMemoria,
  crearEmergenciaPrueba,
} from '../../../../../../test/dobles/emergencias_memoria.js';
import { PublicadorEventosMemoria } from '../../../../../../test/dobles/publicador_eventos_memoria.js';
import { RutasMemoria } from '../../../../../../test/dobles/rutas_memoria.js';
import { TurnosMemoria } from '../../../../../../test/dobles/turnos_memoria.js';
import { ObtenerAsignacion } from '../../../../assignments/application/use-cases/obtener_asignacion.use-case.js';
import { Asignacion } from '../../../../assignments/domain/entities/asignacion.entity.js';
import { ConsultarMisEmergencias } from '../../../../citizens/application/use-cases/consultar_mis_emergencias.use-case.js';
import { ObtenerSeguimientoEmergencia } from '../../../../citizens/application/use-cases/obtener_seguimiento_emergencia.use-case.js';
import { ObtenerEmergencia } from '../../../../emergencies/application/use-cases/obtener_emergencia.use-case.js';
import { ObtenerRutaAsignacion } from '../../../../routing/application/use-cases/obtener_ruta_asignacion.use-case.js';
import { NotificadorSeguimientoCiudadano } from '../../../presentation/listeners/notificador_seguimiento_ciudadano.listener.js';
import { EmisorTiempoRealMemoria } from '../../dobles/emisor_tiempo_real_memoria.js';

describe('NotificadorSeguimientoCiudadano', () => {
  let emergencias: EmergenciasMemoria;
  let asignaciones: AsignacionesMemoria;
  let emisor: EmisorTiempoRealMemoria;
  let notificador: NotificadorSeguimientoCiudadano;

  beforeEach(() => {
    const ambulancias = new AmbulanciasMemoria();
    emergencias = new EmergenciasMemoria();
    asignaciones = new AsignacionesMemoria(ambulancias, emergencias);
    emisor = new EmisorTiempoRealMemoria();
    notificador = new NotificadorSeguimientoCiudadano(
      new PublicadorEventosMemoria(),
      emisor,
      new ObtenerAsignacion(asignaciones),
      new ObtenerEmergencia(emergencias),
      new ObtenerSeguimientoEmergencia(
        new ConsultarMisEmergencias(emergencias),
        asignaciones,
        ambulancias,
        new ObtenerRutaAsignacion(
          new RutasMemoria(),
          asignaciones,
          new TurnosMemoria(),
        ),
      ),
    );
  });

  async function servicio(informanteUsuarioId: string | null) {
    const emergencia = await emergencias.crear(
      crearEmergenciaPrueba({
        informanteUsuarioId,
        latitud: 7.9,
        longitud: -72.5,
      }),
    );
    emergencia.despachar();
    const asignacion = Asignacion.crear({
      emergenciaId: emergencia.id,
      ambulanciaId: 'amb-1',
      turnoId: 't1',
      asignadaPorId: null,
      asignadaEn: new Date(),
    });
    asignaciones.asignaciones.set(asignacion.id, asignacion);
    return asignacion;
  }

  const gps = (asignacionId: string) =>
    notificador.notificar({
      tipo: 'ambulancia.ubicacion_actualizada',
      ambulanciaId: 'amb-1',
      asignacionId,
      latitud: 7.89,
      longitud: -72.5,
      velocidad: null,
      registradaEn: new Date(),
    });

  it('avisa solo a la sala del ciudadano que reportó, con el cuerpo del REST', async () => {
    const asignacion = await servicio('ciudadano-1');

    await notificador.notificar({
      tipo: 'asignacion.creada',
      asignacionId: asignacion.id,
    });

    expect(emisor.emisiones).toEqual([
      expect.objectContaining({
        salas: ['usuario:ciudadano-1'],
        tipo: 'seguimiento.actualizado',
        datos: {
          seguimiento: expect.objectContaining({ disponible: true }) as object,
        },
      }),
    ]);
  });

  it('una emergencia registrada por la central no avisa a nadie', async () => {
    const asignacion = await servicio(null);

    await gps(asignacion.id);

    expect(emisor.emisiones).toEqual([]);
  });

  it('limita los avisos de ubicación como el mapa de la central', async () => {
    const asignacion = await servicio('ciudadano-1');

    await gps(asignacion.id);
    await gps(asignacion.id);

    expect(emisor.emisiones).toHaveLength(1);
  });

  it('al llegar al lugar avisa el fin y deja de enviar posiciones', async () => {
    const asignacion = await servicio('ciudadano-1');
    asignacion.avanzar('en_camino', new Date());
    asignacion.avanzar('en_escena', new Date());
    const emergencia = await emergencias.buscarPorId(asignacion.emergenciaId);
    emergencia?.iniciarAtencion();

    await notificador.notificar({
      tipo: 'asignacion.actualizada',
      asignacionId: asignacion.id,
    });
    await gps(asignacion.id);

    expect(emisor.emisiones).toHaveLength(1);
    expect(emisor.emisiones[0]?.datos).toEqual({
      seguimiento: expect.objectContaining({
        disponible: false,
        motivoNoDisponible: 'ambulancia_en_el_lugar',
      }) as object,
    });
  });
});
