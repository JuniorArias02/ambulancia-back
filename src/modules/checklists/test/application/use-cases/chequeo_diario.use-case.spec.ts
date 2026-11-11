import { AuditoriaMemoria } from '../../../../../../test/dobles/repositorios_memoria.js';
import {
  TurnosMemoria,
  crearTurnoPrueba,
} from '../../../../../../test/dobles/turnos_memoria.js';
import {
  AccesoDenegadoError,
  ConflictoNegocioError,
  RecursoNoEncontradoError,
  ReglaNegocioError,
} from '../../../../../common/exceptions/errores_dominio.js';
import { AmbulanciaDelConductor } from '../../../application/services/ambulancia_del_conductor.service.js';
import { ConsultarChequeosDiarios } from '../../../application/use-cases/consultar_chequeos_diarios.use-case.js';
import { FinalizarChequeoDiario } from '../../../application/use-cases/finalizar_chequeo_diario.use-case.js';
import { IniciarChequeoDiario } from '../../../application/use-cases/iniciar_chequeo_diario.use-case.js';
import { ObtenerMiChequeoDelDia } from '../../../application/use-cases/obtener_mi_chequeo_del_dia.use-case.js';
import { ResponderChequeoDiario } from '../../../application/use-cases/responder_chequeo_diario.use-case.js';
import type { ListaChequeo } from '../../../domain/entities/lista_chequeo.entity.js';
import { ChequeosDiariosMemoria } from '../../dobles/chequeos_diarios_memoria.js';
import {
  ListasChequeoMemoria,
  crearListaPrueba,
} from '../../dobles/listas_chequeo_memoria.js';

/** `crearTurnoPrueba` arma conductor-1 (conductor) y paramedico-1 en la ambulancia. */
const conductor = { usuarioId: 'conductor-1', direccionIp: null };
const paramedico = { usuarioId: 'paramedico-1', direccionIp: null };

describe('Chequeo diario del conductor', () => {
  let turnos: TurnosMemoria;
  let listas: ListasChequeoMemoria;
  let chequeos: ChequeosDiariosMemoria;
  let lista: ListaChequeo;
  let iniciar: IniciarChequeoDiario;
  let responder: ResponderChequeoDiario;
  let finalizar: FinalizarChequeoDiario;
  let consultar: ConsultarChequeosDiarios;

  beforeEach(async () => {
    turnos = new TurnosMemoria();
    listas = new ListasChequeoMemoria();
    chequeos = new ChequeosDiariosMemoria();
    const auditoria = new AuditoriaMemoria();
    lista = crearListaPrueba();
    lista.activar(new Date());
    await listas.crear(lista);
    await turnos.crear(crearTurnoPrueba('amb-1'));

    const delDia = new ObtenerMiChequeoDelDia(
      new AmbulanciaDelConductor(turnos),
      listas,
      chequeos,
    );
    iniciar = new IniciarChequeoDiario(delDia, chequeos, auditoria);
    responder = new ResponderChequeoDiario(delDia, listas, chequeos);
    finalizar = new FinalizarChequeoDiario(delDia, listas, chequeos, auditoria);
    consultar = new ConsultarChequeosDiarios(chequeos, listas);
  });

  const todasBien = () =>
    lista.items.map((item) => ({
      itemId: item.id,
      estadoId: lista.estados[0]?.id ?? '',
      tieneObservacion: false,
    }));

  it('sin ambulancia seleccionada no puede empezar', async () => {
    turnos.turnos.clear();
    await expect(iniciar.ejecutar(conductor)).rejects.toThrow(
      'Seleccione su ambulancia',
    );
  });

  it('el paramédico del turno no la diligencia', async () => {
    await expect(iniciar.ejecutar(paramedico)).rejects.toThrow(
      AccesoDenegadoError,
    );
  });

  it('sin lista activa responde 404', async () => {
    lista.desactivar(new Date());
    await expect(iniciar.ejecutar(conductor)).rejects.toThrow(
      RecursoNoEncontradoError,
    );
  });

  it('iniciar dos veces el mismo día devuelve el mismo chequeo, con la ambulancia del turno', async () => {
    const primero = await iniciar.ejecutar(conductor);
    const segundo = await iniciar.ejecutar(conductor);

    expect(primero.creado).toBe(true);
    expect(segundo.creado).toBe(false);
    expect(segundo.chequeo.id).toBe(primero.chequeo.id);
    expect(primero.chequeo.ambulanciaId).toBe('amb-1');
  });

  it('cerca de medianoche usa el día de Colombia', async () => {
    const { chequeo } = await iniciar.ejecutar(
      conductor,
      new Date('2026-11-10T03:00:00Z'),
    );
    expect(chequeo.fecha).toBe('2026-11-09');
  });

  it('responde por partes, finaliza y ya no se edita', async () => {
    await iniciar.ejecutar(conductor);
    const [primera, segunda] = todasBien();
    await responder.ejecutar(primera ? [primera] : [], conductor);
    await expect(finalizar.ejecutar(conductor)).rejects.toThrow(
      ReglaNegocioError,
    );

    await responder.ejecutar(segunda ? [segunda] : [], conductor);
    const { chequeo } = await finalizar.ejecutar(conductor);

    expect(chequeo.estado).toBe('finalizado');
    await expect(responder.ejecutar(todasBien(), conductor)).rejects.toThrow(
      'ya fue finalizado',
    );
  });

  it('responder sin haber iniciado responde 404', async () => {
    await expect(responder.ejecutar(todasBien(), conductor)).rejects.toThrow(
      RecursoNoEncontradoError,
    );
  });

  it('si otra solicitud finalizó antes, 409', async () => {
    await iniciar.ejecutar(conductor);
    await responder.ejecutar(todasBien(), conductor);
    chequeos.forzarConflicto = true;

    await expect(finalizar.ejecutar(conductor)).rejects.toThrow(
      ConflictoNegocioError,
    );
  });

  it('en el historial el conductor solo ve los suyos', async () => {
    const { chequeo } = await iniciar.ejecutar(conductor);

    const propios = await consultar.listar(
      {},
      { pagina: 1, limite: 20 },
      'conductor-1',
    );
    const ajenos = await consultar.listar(
      { conductorId: 'conductor-1' },
      { pagina: 1, limite: 20 },
      'otro-conductor',
    );
    expect(propios.datos).toHaveLength(1);
    expect(ajenos.datos).toHaveLength(0);
    await expect(
      consultar.obtener(chequeo.id, 'otro-conductor'),
    ).rejects.toThrow(RecursoNoEncontradoError);
  });
});
