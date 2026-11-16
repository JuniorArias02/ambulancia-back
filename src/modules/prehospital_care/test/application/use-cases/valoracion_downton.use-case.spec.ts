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
  ConflictoNegocioError,
  RecursoNoEncontradoError,
  ReglaNegocioError,
} from '../../../../../common/exceptions/errores_dominio.js';
import { Asignacion } from '../../../../assignments/domain/entities/asignacion.entity.js';
import { AccesoHistoriaClinica } from '../../../application/services/acceso_historia_clinica.service.js';
import { AbrirHistoriaClinica } from '../../../application/use-cases/abrir_historia_clinica.use-case.js';
import { AnularHistoriaClinica } from '../../../application/use-cases/anular_historia_clinica.use-case.js';
import { ConsultarValoracionesDownton } from '../../../application/use-cases/consultar_valoraciones_downton.use-case.js';
import { ObtenerHistoriaClinica } from '../../../application/use-cases/obtener_historia_clinica.use-case.js';
import { ObtenerValoracionDownton } from '../../../application/use-cases/obtener_valoracion_downton.use-case.js';
import { RegistrarEnHistoria } from '../../../application/use-cases/registrar_en_historia.use-case.js';
import { RegistrarValoracionDownton } from '../../../application/use-cases/registrar_valoracion_downton.use-case.js';
import type { RespuestasDownton } from '../../../domain/entities/valoracion_downton.entity.js';
import {
  HistoriasClinicasMemoria,
  IndicePacientesMemoria,
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

/** 4 puntos: caídas previas, diurético, déficit visual y confuso. */
const RIESGO_ALTO: RespuestasDownton = {
  caidasPrevias: true,
  medTranquilizantesSedantes: false,
  medDiureticos: true,
  medHipotensores: false,
  medAntiparkinsonianos: false,
  medAntidepresivos: false,
  medOtros: false,
  deficitVisual: true,
  deficitAuditivo: false,
  deficitExtremidades: false,
  estadoMental: 'confuso',
  deambulacion: 'normal',
};

describe('Valoración de riesgo de caídas Downton (casos de uso)', () => {
  let historias: HistoriasClinicasMemoria;
  let auditoria: AuditoriaMemoria;
  let indice: IndicePacientesMemoria;
  let asignacion: Asignacion;
  let abrir: AbrirHistoriaClinica;
  let registrar: RegistrarValoracionDownton;
  let consultar: ConsultarValoracionesDownton;
  let obtener: ObtenerValoracionDownton;
  let obtenerHistoria: ObtenerHistoriaClinica;
  let registrosHistoria: RegistrarEnHistoria;
  let anular: AnularHistoriaClinica;

  beforeEach(async () => {
    const ambulancias = new AmbulanciasMemoria();
    const emergencias = new EmergenciasMemoria();
    const turnos = new TurnosMemoria();
    const asignaciones = new AsignacionesMemoria(ambulancias, emergencias);
    historias = new HistoriasClinicasMemoria();
    auditoria = new AuditoriaMemoria();
    indice = new IndicePacientesMemoria();

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

    const acceso = new AccesoHistoriaClinica(historias, asignaciones, turnos);
    abrir = new AbrirHistoriaClinica(historias, acceso, auditoria, indice);
    registrar = new RegistrarValoracionDownton(historias, acceso, auditoria);
    consultar = new ConsultarValoracionesDownton(historias, acceso, auditoria);
    obtener = new ObtenerValoracionDownton(historias, acceso, auditoria);
    obtenerHistoria = new ObtenerHistoriaClinica(historias, acceso, auditoria);
    registrosHistoria = new RegistrarEnHistoria(historias, acceso, auditoria);
    anular = new AnularHistoriaClinica(historias, acceso, auditoria);
  });

  async function abrirHistoria() {
    return (await abrir.ejecutar({ asignacionId: asignacion.id }, paramedico))
      .detalle.historia;
  }

  it('el paramédico la registra y el backend calcula puntaje y nivel', async () => {
    const historia = await abrirHistoria();

    const valoracion = await registrar.ejecutar(
      historia.id,
      { respuestas: RIESGO_ALTO, observacion: 'Usa bastón' },
      paramedico,
    );

    expect(valoracion).toMatchObject({
      historiaClinicaId: historia.id,
      puntajeTotal: 4,
      nivelRiesgo: 'alto',
      origen: 'manual',
      confirmado: true,
      registradoPorId: paramedico.usuarioId,
      observacion: 'Usa bastón',
    });
  });

  it('es opcional: la historia funciona sin valoraciones y el detalle las incluye cuando hay', async () => {
    const historia = await abrirHistoria();
    const vacia = await obtenerHistoria.ejecutar(
      historia.id,
      { usuarioId: paramedico.usuarioId, rol: paramedico.rol },
      paramedico,
    );
    expect(vacia.valoracionesDownton).toEqual([]);

    await registrar.ejecutar(
      historia.id,
      { respuestas: RIESGO_ALTO },
      paramedico,
    );
    const detalle = await obtenerHistoria.ejecutar(
      historia.id,
      { usuarioId: paramedico.usuarioId, rol: paramedico.rol },
      paramedico,
    );
    expect(detalle.valoracionesDownton).toHaveLength(1);
  });

  it('reenviar el mismo id no la duplica; el mismo id en otra historia es 409', async () => {
    const historia = await abrirHistoria();
    const otra = await abrirHistoria();
    const id = '3c1e0b9a-1d2f-4e5a-8b6c-7d8e9f0a1b2c';

    await registrar.ejecutar(
      historia.id,
      { id, respuestas: RIESGO_ALTO },
      paramedico,
    );
    await registrar.ejecutar(
      historia.id,
      { id, respuestas: RIESGO_ALTO },
      paramedico,
    );

    expect(historias.valoracionesDownton).toHaveLength(1);
    await expect(
      registrar.ejecutar(otra.id, { id, respuestas: RIESGO_ALTO }, paramedico),
    ).rejects.toThrow(ConflictoNegocioError);
  });

  it('el conductor y un paramédico de otro servicio no pueden registrar ni consultar', async () => {
    const historia = await abrirHistoria();
    await expect(
      registrar.ejecutar(historia.id, { respuestas: RIESGO_ALTO }, conductor),
    ).rejects.toThrow(AccesoDenegadoError);
    await expect(
      consultar.ejecutar(
        historia.id,
        { usuarioId: 'paramedico-2', rol: Roles.PARAMEDICO },
        paramedico,
      ),
    ).rejects.toThrow(AccesoDenegadoError);
  });

  it('el administrador consulta la lista y el detalle; cada consulta queda auditada', async () => {
    const historia = await abrirHistoria();
    const creada = await registrar.ejecutar(
      historia.id,
      { respuestas: RIESGO_ALTO },
      paramedico,
    );
    const solicitante = { usuarioId: admin.usuarioId, rol: admin.rol };

    const lista = await consultar.ejecutar(historia.id, solicitante, admin);
    expect(lista.map((v) => v.id)).toEqual([creada.id]);
    expect(auditoria.eventos.at(-1)?.accion).toBe(
      'consultar_valoraciones_downton',
    );

    const detalle = await obtener.ejecutar(
      historia.id,
      creada.id,
      solicitante,
      admin,
    );
    expect(detalle.puntajeTotal).toBe(4);
    await expect(
      obtener.ejecutar(
        historia.id,
        '00000000-0000-4000-8000-000000000000',
        solicitante,
        admin,
      ),
    ).rejects.toThrow(RecursoNoEncontradoError);
  });

  it('la auditoría guarda solo el id del registro, nunca el puntaje ni las respuestas', async () => {
    const historia = await abrirHistoria();
    const valoracion = await registrar.ejecutar(
      historia.id,
      { respuestas: RIESGO_ALTO, observacion: 'Paciente confuso' },
      paramedico,
    );

    const evento = auditoria.eventos.at(-1);
    expect(evento?.accion).toBe('registrar_valoracion_downton');
    expect(evento?.detalle).toEqual({ registroId: valoracion.id });
  });

  it('no se registra en una historia anulada (o cerrada)', async () => {
    const historia = await abrirHistoria();
    await anular.ejecutar(historia.id, 'Duplicada', admin);

    await expect(
      registrar.ejecutar(historia.id, { respuestas: RIESGO_ALTO }, paramedico),
    ).rejects.toThrow(ReglaNegocioError);
  });

  it('con origen voz, el segmento debe ser de una grabación de esa historia', async () => {
    const historia = await abrirHistoria();
    historias.segmentosAudio.set('segmento-propio', historia.id);
    historias.segmentosAudio.set('segmento-ajeno', 'otra-historia');

    await expect(
      registrar.ejecutar(
        historia.id,
        {
          respuestas: RIESGO_ALTO,
          origen: 'voz',
          segmentoAudioId: 'segmento-ajeno',
        },
        paramedico,
      ),
    ).rejects.toThrow(/no pertenece/);
    const deVoz = await registrar.ejecutar(
      historia.id,
      {
        respuestas: RIESGO_ALTO,
        origen: 'voz',
        segmentoAudioId: 'segmento-propio',
      },
      paramedico,
    );
    expect(deVoz).toMatchObject({ origen: 'voz', confirmado: true });
  });

  it('se puede quitar mientras la historia es borrador y queda auditado', async () => {
    const historia = await abrirHistoria();
    const valoracion = await registrar.ejecutar(
      historia.id,
      { respuestas: RIESGO_ALTO },
      paramedico,
    );

    await registrosHistoria.eliminar(
      'valoracion_downton',
      historia.id,
      valoracion.id,
      paramedico,
    );

    expect(historias.valoracionesDownton).toHaveLength(0);
    expect(auditoria.eventos.at(-1)?.accion).toBe(
      'eliminar_valoracion_downton',
    );
  });
});
