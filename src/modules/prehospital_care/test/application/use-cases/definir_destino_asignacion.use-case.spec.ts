import { PublicadorEventosMemoria } from '../../../../../../test/dobles/publicador_eventos_memoria.js';
import { AmbulanciasMemoria } from '../../../../../../test/dobles/ambulancias_memoria.js';
import { AsignacionesMemoria } from '../../../../../../test/dobles/asignaciones_memoria.js';
import { EmergenciasMemoria } from '../../../../../../test/dobles/emergencias_memoria.js';
import { AuditoriaMemoria } from '../../../../../../test/dobles/repositorios_memoria.js';
import {
  TurnosMemoria,
  crearTurnoPrueba,
} from '../../../../../../test/dobles/turnos_memoria.js';
import { Roles } from '../../../../../common/constants/roles.js';
import {
  AccesoDenegadoError,
  RecursoNoEncontradoError,
  ReglaNegocioError,
} from '../../../../../common/exceptions/errores_dominio.js';
import { PermisoServicio } from '../../../../assignments/application/services/permiso_servicio.service.js';
import {
  Asignacion,
  type EstadoAsignacion,
} from '../../../../assignments/domain/entities/asignacion.entity.js';
import { DefinirDestinoAsignacion } from '../../../application/use-cases/definir_destino_asignacion.use-case.js';
import { InstitucionSalud } from '../../../domain/entities/institucion_salud.entity.js';
import type { InstitucionesSaludRepositorio } from '../../../domain/repositories/instituciones_salud.repository.js';

const conductor = { usuarioId: 'conductor-1', rol: Roles.CONDUCTOR };
const contexto = { usuarioId: 'conductor-1', direccionIp: null };

describe('DefinirDestinoAsignacion', () => {
  const instituciones = new Map<string, InstitucionSalud>();
  let asignaciones: AsignacionesMemoria;
  let auditoria: AuditoriaMemoria;
  let eventos: PublicadorEventosMemoria;
  let definir: DefinirDestinoAsignacion;
  let turnoId: string;

  function institucion(
    nombre: string,
    cambios: { activa?: boolean; conCoordenadas?: boolean } = {},
  ): InstitucionSalud {
    const creada = InstitucionSalud.reconstruir({
      id: crypto.randomUUID(),
      nombre,
      codigoHabilitacion: null,
      nivelComplejidad: null,
      telefono: null,
      direccion: null,
      coordenadas:
        cambios.conCoordenadas === false
          ? null
          : { latitud: 7.91, longitud: -72.49 },
      activa: cambios.activa ?? true,
    });
    instituciones.set(creada.id, creada);
    return creada;
  }

  function servicio(estado: EstadoAsignacion): Asignacion {
    const base = Asignacion.crear({
      emergenciaId: 'e1',
      ambulanciaId: 'amb-1',
      turnoId,
      asignadaPorId: null,
      asignadaEn: new Date(),
    });
    const conEstado = Asignacion.reconstruir({
      id: base.id,
      emergenciaId: 'e1',
      ambulanciaId: 'amb-1',
      turnoId,
      asignadaPorId: null,
      estado,
      motivoCancelacion: null,
      asignadaEn: base.asignadaEn,
      salidaEn: null,
      llegadaEscenaEn: null,
      atencionInicioEn: null,
      salidaEscenaEn: null,
      llegadaDestinoEn: null,
      finalizadaEn: null,
      destino: null,
      destinoActualizadoPorId: null,
      destinoActualizadoEn: null,
      destinoActualizadoPorNombre: null,
      numeroEmergencia: null,
      ambulanciaCodigo: null,
      asignadaPorNombre: null,
    });
    asignaciones.asignaciones.set(conEstado.id, conEstado);
    return conEstado;
  }

  beforeEach(async () => {
    instituciones.clear();
    const turnos = new TurnosMemoria();
    turnoId = (await turnos.crear(crearTurnoPrueba('amb-1'))).id;
    asignaciones = new AsignacionesMemoria(
      new AmbulanciasMemoria(),
      new EmergenciasMemoria(),
    );
    auditoria = new AuditoriaMemoria();
    eventos = new PublicadorEventosMemoria();
    definir = new DefinirDestinoAsignacion(
      asignaciones,
      {
        buscarPorId: (id: string) =>
          Promise.resolve(instituciones.get(id) ?? null),
      } as unknown as InstitucionesSaludRepositorio,
      new PermisoServicio(turnos),
      auditoria,
      eventos,
    );
  });

  it('guarda el hospital, quién lo eligió y avisa', async () => {
    const a = servicio('atendiendo');
    const hospital = institucion('Hospital Uno');

    const resultado = await definir.ejecutar(
      a.id,
      hospital.id,
      conductor,
      contexto,
    );

    expect(resultado.destino?.institucionId).toBe(hospital.id);
    expect(resultado.destinoActualizadoPorId).toBe('conductor-1');
    expect(resultado.destinoActualizadoEn).toBeInstanceOf(Date);
    expect(eventos.eventos).toEqual([
      { tipo: 'asignacion.actualizada', asignacionId: a.id },
    ]);
  });

  it('al cambiarlo, la auditoría conserva el anterior y el nuevo', async () => {
    const a = servicio('trasladando');
    const uno = institucion('Hospital Uno');
    const dos = institucion('Hospital Dos');
    await definir.ejecutar(a.id, uno.id, conductor, contexto);

    await definir.ejecutar(a.id, dos.id, conductor, contexto);

    expect(auditoria.eventos.at(-1)).toEqual(
      expect.objectContaining({
        usuarioId: 'conductor-1',
        accion: 'definir_destino',
        detalle: expect.objectContaining({
          institucionAnteriorId: uno.id,
          institucionNuevaId: dos.id,
        }) as object,
      }),
    );
  });

  it('un reintento con el mismo hospital no audita ni avisa', async () => {
    const a = servicio('trasladando');
    const hospital = institucion('Hospital Uno');
    await definir.ejecutar(a.id, hospital.id, conductor, contexto);
    eventos.eventos.length = 0;
    const auditados = auditoria.eventos.length;

    await definir.ejecutar(a.id, hospital.id, conductor, contexto);

    expect(eventos.eventos).toEqual([]);
    expect(auditoria.eventos).toHaveLength(auditados);
  });

  it('el paramédico del servicio y otro conductor no pueden elegirlo', async () => {
    const a = servicio('trasladando');
    const hospital = institucion('Hospital Uno');

    await expect(
      definir.ejecutar(
        a.id,
        hospital.id,
        { usuarioId: 'paramedico-1', rol: Roles.PARAMEDICO },
        contexto,
      ),
    ).rejects.toThrow(AccesoDenegadoError);
    await expect(
      definir.ejecutar(
        a.id,
        hospital.id,
        { usuarioId: 'conductor-2', rol: Roles.CONDUCTOR },
        contexto,
      ),
    ).rejects.toThrow(AccesoDenegadoError);
  });

  it.each(['asignada', 'en_camino', 'finalizada', 'cancelada'] as const)(
    'no se puede definir en %s',
    async (estado) => {
      const a = servicio(estado);
      await expect(
        definir.ejecutar(a.id, institucion('H').id, conductor, contexto),
      ).rejects.toThrow(ReglaNegocioError);
    },
  );

  it('rechaza una institución inactiva, sin coordenadas o inexistente', async () => {
    const a = servicio('atendiendo');
    await expect(
      definir.ejecutar(
        a.id,
        institucion('Inactiva', { activa: false }).id,
        conductor,
        contexto,
      ),
    ).rejects.toThrow(ReglaNegocioError);
    await expect(
      definir.ejecutar(
        a.id,
        institucion('Sin mapa', { conCoordenadas: false }).id,
        conductor,
        contexto,
      ),
    ).rejects.toThrow(ReglaNegocioError);
    await expect(
      definir.ejecutar(a.id, 'no-existe', conductor, contexto),
    ).rejects.toThrow(RecursoNoEncontradoError);
  });
});
