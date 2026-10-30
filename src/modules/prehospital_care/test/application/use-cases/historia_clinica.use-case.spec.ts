import {
  AmbulanciasMemoria,
  crearAmbulanciaPrueba,
} from '../../../../../../test/dobles/ambulancias_memoria.js';
import { AsignacionesMemoria } from '../../../../../../test/dobles/asignaciones_memoria.js';
import {
  EmergenciasMemoria,
  crearEmergenciaPrueba,
} from '../../../../../../test/dobles/emergencias_memoria.js';
import { AuditoriaMemoria } from '../../../../../../test/dobles/repositorios_memoria.js';
import {
  TurnosMemoria,
  crearTurnoPrueba,
} from '../../../../../../test/dobles/turnos_memoria.js';
import { Roles } from '../../../../../common/constants/roles.js';
import {
  AccesoDenegadoError,
  ReglaNegocioError,
} from '../../../../../common/exceptions/errores_dominio.js';
import { Asignacion } from '../../../../assignments/domain/entities/asignacion.entity.js';
import { AccesoHistoriaClinica } from '../../../application/services/acceso_historia_clinica.service.js';
import { HuellaHistoria } from '../../../application/services/huella_historia.service.js';
import { AbrirHistoriaClinica } from '../../../application/use-cases/abrir_historia_clinica.use-case.js';
import { ActualizarHistoriaClinica } from '../../../application/use-cases/actualizar_historia_clinica.use-case.js';
import { AnularHistoriaClinica } from '../../../application/use-cases/anular_historia_clinica.use-case.js';
import { CerrarHistoriaClinica } from '../../../application/use-cases/cerrar_historia_clinica.use-case.js';
import { ConsultarHistoriasClinicas } from '../../../application/use-cases/consultar_historias_clinicas.use-case.js';
import { ObtenerHistoriaClinica } from '../../../application/use-cases/obtener_historia_clinica.use-case.js';
import { RegistrarEnHistoria } from '../../../application/use-cases/registrar_en_historia.use-case.js';
import { InstitucionSalud } from '../../../domain/entities/institucion_salud.entity.js';
import type { MedicionesSignoVital } from '../../../domain/entities/registros_clinicos.js';
import {
  HistoriasClinicasMemoria,
  InstitucionesSaludMemoria,
} from '../../dobles/historias_memoria.js';

const paramedico = {
  usuarioId: 'paramedico-1',
  direccionIp: null,
  rol: Roles.PARAMEDICO,
};
const conductor = {
  usuarioId: 'conductor-1',
  direccionIp: null,
  rol: Roles.CONDUCTOR,
};
const admin = {
  usuarioId: 'admin-1',
  direccionIp: null,
  rol: Roles.ADMINISTRADOR,
};

const SIGNOS: MedicionesSignoVital = {
  presionSistolica: 120,
  presionDiastolica: 80,
  frecuenciaCardiaca: 88,
  frecuenciaRespiratoria: 18,
  saturacionOxigeno: 96,
  temperatura: 36.5,
  glucometria: null,
  glasgowOcular: 4,
  glasgowVerbal: 5,
  glasgowMotor: 6,
  escalaDolor: 3,
};

describe('Historia clínica (casos de uso)', () => {
  let historias: HistoriasClinicasMemoria;
  let instituciones: InstitucionesSaludMemoria;
  let auditoria: AuditoriaMemoria;
  let asignacion: Asignacion;
  let abrir: AbrirHistoriaClinica;
  let actualizar: ActualizarHistoriaClinica;
  let registrar: RegistrarEnHistoria;
  let cerrar: CerrarHistoriaClinica;
  let obtener: ObtenerHistoriaClinica;
  let consultar: ConsultarHistoriasClinicas;
  let anular: AnularHistoriaClinica;
  let hospitalId: string;

  beforeEach(async () => {
    const ambulancias = new AmbulanciasMemoria();
    const emergencias = new EmergenciasMemoria();
    const turnos = new TurnosMemoria();
    const asignaciones = new AsignacionesMemoria(ambulancias, emergencias);
    historias = new HistoriasClinicasMemoria();
    instituciones = new InstitucionesSaludMemoria();
    auditoria = new AuditoriaMemoria();

    const ambulancia = await ambulancias.crear(crearAmbulanciaPrueba());
    const turno = await turnos.crear(crearTurnoPrueba(ambulancia.id));
    const emergencia = await emergencias.crear(crearEmergenciaPrueba());
    asignacion = Asignacion.crear({
      emergenciaId: emergencia.id,
      ambulanciaId: ambulancia.id,
      turnoId: turno.id,
      asignadaPorId: 'despachador-1',
      asignadaEn: new Date(),
    });
    asignaciones.asignaciones.set(asignacion.id, asignacion);
    const hospital = await instituciones.crear(
      InstitucionSalud.crear({ nombre: 'Hospital Erasmo Meoz' }),
    );
    hospitalId = hospital.id;

    const acceso = new AccesoHistoriaClinica(historias, asignaciones, turnos);
    abrir = new AbrirHistoriaClinica(historias, acceso, auditoria);
    actualizar = new ActualizarHistoriaClinica(
      historias,
      instituciones,
      acceso,
      auditoria,
    );
    registrar = new RegistrarEnHistoria(historias, acceso, auditoria);
    cerrar = new CerrarHistoriaClinica(
      historias,
      acceso,
      new HuellaHistoria(),
      auditoria,
    );
    obtener = new ObtenerHistoriaClinica(historias, acceso, auditoria);
    consultar = new ConsultarHistoriasClinicas(historias, acceso);
    anular = new AnularHistoriaClinica(historias, acceso, auditoria);
  });

  async function abrirHistoria(id?: string) {
    return (
      await abrir.ejecutar({ id, asignacionId: asignacion.id }, paramedico)
    ).detalle.historia;
  }

  it('el paramédico del servicio abre la historia con número consecutivo', async () => {
    const primera = await abrirHistoria();
    const segunda = await abrirHistoria();

    expect(primera.numeroHistoria).toMatch(/^HC-\d{8}-0001$/);
    expect(segunda.numeroHistoria).toMatch(/^HC-\d{8}-0002$/);
    expect(primera.emergenciaId).toBe(asignacion.emergenciaId);
    expect(auditoria.eventos[0]?.detalle).toEqual({
      numeroHistoria: primera.numeroHistoria,
      asignacionId: asignacion.id,
    });
  });

  it('reenviar el mismo id desde el celular no duplica la historia', async () => {
    const id = '0c6f1d2e-3b4a-4c5d-8e9f-a0b1c2d3e4f5';
    await abrirHistoria(id);

    const reintento = await abrir.ejecutar(
      { id, asignacionId: asignacion.id },
      paramedico,
    );

    expect(reintento.creada).toBe(false);
    expect(historias.historias.size).toBe(1);
  });

  it('el conductor no puede abrir ni ver historias clínicas', async () => {
    await expect(
      abrir.ejecutar({ asignacionId: asignacion.id }, conductor),
    ).rejects.toThrow(AccesoDenegadoError);
    const historia = await abrirHistoria();
    await expect(
      obtener.ejecutar(
        historia.id,
        { usuarioId: conductor.usuarioId, rol: conductor.rol },
        conductor,
      ),
    ).rejects.toThrow(AccesoDenegadoError);
  });

  it('un paramédico de otra ambulancia no puede verla; el administrador sí', async () => {
    const historia = await abrirHistoria();

    await expect(
      obtener.ejecutar(
        historia.id,
        { usuarioId: 'paramedico-2', rol: Roles.PARAMEDICO },
        paramedico,
      ),
    ).rejects.toThrow(AccesoDenegadoError);
    const detalle = await obtener.ejecutar(
      historia.id,
      { usuarioId: admin.usuarioId, rol: admin.rol },
      admin,
    );
    expect(detalle.historia.id).toBe(historia.id);
    expect(auditoria.eventos.at(-1)?.accion).toBe('consultar');
  });

  it('registra signos vitales sin duplicar al reenviar el mismo id', async () => {
    const historia = await abrirHistoria();
    const id = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

    await registrar.signoVital(
      historia.id,
      { id, mediciones: SIGNOS },
      paramedico,
    );
    const repetido = await registrar.signoVital(
      historia.id,
      { id, mediciones: SIGNOS },
      paramedico,
    );

    expect(repetido.glasgowTotal).toBe(15);
    expect(historias.signos).toHaveLength(1);
  });

  it('no deja asignar una institución de destino que no existe', async () => {
    const historia = await abrirHistoria();
    await expect(
      actualizar.ejecutar(
        historia.id,
        { institucionDestinoId: crypto.randomUUID() },
        paramedico,
      ),
    ).rejects.toThrow('institución de destino');
  });

  it('flujo completo: llenar, intentar cerrar incompleta, completar, cerrar y quedar sellada', async () => {
    const historia = await abrirHistoria();
    await actualizar.ejecutar(
      historia.id,
      {
        pacienteIdentificado: true,
        nombres: 'Juan',
        apellidos: 'Pérez',
        triage: 'amarillo',
      },
      paramedico,
    );
    await registrar.lesion(
      historia.id,
      { regionCorporal: 'miembro_inferior_derecho', tipoLesion: 'fractura' },
      paramedico,
    );
    await registrar.intervencion(
      historia.id,
      { tipo: 'procedimiento', nombre: 'Inmovilización' },
      paramedico,
    );

    await expect(cerrar.ejecutar(historia.id, paramedico)).rejects.toThrow(
      /desenlace.*signos vitales/,
    );

    await registrar.signoVital(historia.id, { mediciones: SIGNOS }, paramedico);
    const detalle = await actualizar.ejecutar(
      historia.id,
      {
        desenlace: 'trasladado',
        institucionDestinoId: hospitalId,
        receptorNombre: 'Dra. Gómez',
      },
      paramedico,
    );
    expect(detalle.lesiones).toHaveLength(1);

    const cerrada = await cerrar.ejecutar(historia.id, paramedico);
    expect(cerrada.historia.estado).toBe('cerrada');
    expect(cerrada.historia.hashCierre).toMatch(/^[0-9a-f]{64}$/);
    expect(cerrada.historia.cerradaPorId).toBe('paramedico-1');

    await expect(
      actualizar.ejecutar(historia.id, { observaciones: 'cambio' }, paramedico),
    ).rejects.toThrow(ReglaNegocioError);
    await expect(
      registrar.signoVital(historia.id, { mediciones: SIGNOS }, paramedico),
    ).rejects.toThrow(ReglaNegocioError);
  });

  it('la auditoría guarda los nombres de los campos, nunca los datos clínicos', async () => {
    const historia = await abrirHistoria();
    await actualizar.ejecutar(
      historia.id,
      { nombres: 'Juan', alergias: 'Penicilina' },
      paramedico,
    );

    const evento = auditoria.eventos.at(-1);
    expect(evento?.detalle).toEqual({ campos: ['nombres', 'alergias'] });
    expect(JSON.stringify(auditoria.eventos)).not.toContain('Penicilina');
  });

  it('lista las historias del servicio para su tripulación', async () => {
    await abrirHistoria();
    await abrirHistoria();
    const lista = await consultar.ejecutar(
      { asignacionId: asignacion.id },
      { usuarioId: paramedico.usuarioId, rol: paramedico.rol },
    );
    expect(lista).toHaveLength(2);
  });

  it('el administrador anula sin borrar y deja el motivo en la auditoría', async () => {
    const historia = await abrirHistoria();
    const anulada = await anular.ejecutar(
      historia.id,
      'Abierta por error',
      admin,
    );

    expect(anulada.estado).toBe('anulada');
    expect(auditoria.eventos.at(-1)?.detalle).toEqual({
      estadoAnterior: 'borrador',
      motivo: 'Abierta por error',
    });
  });
});
