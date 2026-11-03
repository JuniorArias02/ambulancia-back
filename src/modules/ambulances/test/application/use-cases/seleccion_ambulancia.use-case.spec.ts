import {
  AmbulanciasMemoria,
  crearAmbulanciaPrueba,
} from '../../../../../../test/dobles/ambulancias_memoria.js';
import { PublicadorEventosMemoria } from '../../../../../../test/dobles/publicador_eventos_memoria.js';
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
import { ConsultarAmbulanciasSeleccionables } from '../../../application/use-cases/consultar_ambulancias_seleccionables.use-case.js';
import { FinalizarTurno } from '../../../application/use-cases/finalizar_turno.use-case.js';
import { SalirDeAmbulancia } from '../../../application/use-cases/salir_de_ambulancia.use-case.js';
import { SeleccionarAmbulancia } from '../../../application/use-cases/seleccionar_ambulancia.use-case.js';
import { Ambulancia } from '../../../domain/entities/ambulancia.entity.js';

const conductor = {
  usuarioId: 'c1',
  direccionIp: null,
  rol: Roles.CONDUCTOR,
};
const paramedico = {
  usuarioId: 'p1',
  direccionIp: null,
  rol: Roles.PARAMEDICO,
};
const despachador = {
  usuarioId: 'd1',
  direccionIp: null,
  rol: Roles.DESPACHADOR,
};

describe('Selección de ambulancia por la tripulación', () => {
  let ambulancias: AmbulanciasMemoria;
  let turnos: TurnosMemoria;
  let auditoria: AuditoriaMemoria;
  let eventos: PublicadorEventosMemoria;
  let seleccionar: SeleccionarAmbulancia;
  let salir: SalirDeAmbulancia;
  let opciones: ConsultarAmbulanciasSeleccionables;
  let finalizar: FinalizarTurno;

  beforeEach(() => {
    ambulancias = new AmbulanciasMemoria();
    turnos = new TurnosMemoria(ambulancias);
    auditoria = new AuditoriaMemoria();
    eventos = new PublicadorEventosMemoria();
    seleccionar = new SeleccionarAmbulancia(turnos, auditoria, eventos);
    salir = new SalirDeAmbulancia(turnos, auditoria, eventos);
    opciones = new ConsultarAmbulanciasSeleccionables(ambulancias, turnos);
    finalizar = new FinalizarTurno(turnos, auditoria, eventos);
  });

  const ambulanciaNueva = (codigo = 'amb-01'): Promise<Ambulancia> =>
    ambulancias.crear(crearAmbulanciaPrueba({ codigo, placa: `${codigo}x` }));

  const conEstado = (
    ambulancia: Ambulancia,
    estadoOperativo: 'en_servicio' | 'mantenimiento',
  ): Promise<Ambulancia> =>
    ambulancias.crear(
      Ambulancia.reconstruir({
        id: ambulancia.id,
        codigo: ambulancia.codigo,
        placa: ambulancia.placa,
        tipo: ambulancia.tipo,
        estadoOperativo,
        ultimaUbicacion: null,
        creadaEn: ambulancia.creadaEn,
      }),
    );

  describe('seleccionar', () => {
    it('toma la función del rol y sigue fuera de servicio hasta completar la tripulación', async () => {
      const ambulancia = await ambulanciaNueva();

      const turno = await seleccionar.ejecutar(ambulancia.id, conductor);

      expect(turno.funcionDe('c1')).toBe('conductor');
      expect(turno.tieneTripulacionCompleta()).toBe(false);
      expect(ambulancia.estadoOperativo).toBe('fuera_servicio');
      expect(auditoria.eventos).toEqual([
        expect.objectContaining({
          entidad: 'turnos',
          accion: 'seleccionar_ambulancia',
          detalle: expect.objectContaining({ funcion: 'conductor' }) as object,
        }),
      ]);
    });

    it('al completarse la tripulación queda disponible, con historial y aviso', async () => {
      const ambulancia = await ambulanciaNueva();

      const primero = await seleccionar.ejecutar(ambulancia.id, conductor);
      const segundo = await seleccionar.ejecutar(ambulancia.id, paramedico);

      expect(segundo.id).toBe(primero.id);
      expect(segundo.tieneTripulacionCompleta()).toBe(true);
      expect(ambulancia.estadoOperativo).toBe('disponible');
      expect(ambulancias.historial).toEqual([
        expect.objectContaining({
          estadoNuevo: 'disponible',
          usuarioId: 'p1',
        }),
      ]);
      expect(eventos.eventos).toContainEqual({
        tipo: 'ambulancia.actualizada',
        ambulanciaId: ambulancia.id,
      });
    });

    it('un reintento en la misma ambulancia no cambia nada', async () => {
      const ambulancia = await ambulanciaNueva();
      const turno = await seleccionar.ejecutar(ambulancia.id, conductor);
      const auditados = auditoria.eventos.length;

      const repetido = await seleccionar.ejecutar(ambulancia.id, conductor);

      expect(repetido.id).toBe(turno.id);
      expect(repetido.integrantes).toHaveLength(1);
      expect(auditoria.eventos).toHaveLength(auditados);
    });

    it('rechaza si ya está en otra ambulancia', async () => {
      const a1 = await ambulanciaNueva('amb-01');
      const a2 = await ambulanciaNueva('amb-02');
      await seleccionar.ejecutar(a1.id, conductor);

      await expect(seleccionar.ejecutar(a2.id, conductor)).rejects.toThrow(
        ConflictoNegocioError,
      );
    });

    it('rechaza un segundo conductor', async () => {
      const ambulancia = await ambulanciaNueva();
      await seleccionar.ejecutar(ambulancia.id, conductor);

      await expect(
        seleccionar.ejecutar(ambulancia.id, { ...conductor, usuarioId: 'c2' }),
      ).rejects.toThrow(ConflictoNegocioError);
    });

    it('admite varios paramédicos hasta llenar los cupos', async () => {
      const ambulancia = await ambulanciaNueva();
      await seleccionar.ejecutar(ambulancia.id, conductor);
      for (const usuarioId of ['p1', 'p2', 'p3']) {
        await seleccionar.ejecutar(ambulancia.id, { ...paramedico, usuarioId });
      }

      await expect(
        seleccionar.ejecutar(ambulancia.id, { ...paramedico, usuarioId: 'p4' }),
      ).rejects.toThrow(ConflictoNegocioError);
    });

    it('rechaza una ambulancia en servicio o en mantenimiento', async () => {
      const a1 = await conEstado(
        await ambulanciaNueva('amb-01'),
        'en_servicio',
      );
      const a2 = await conEstado(
        await ambulanciaNueva('amb-02'),
        'mantenimiento',
      );

      await expect(seleccionar.ejecutar(a1.id, conductor)).rejects.toThrow(
        ConflictoNegocioError,
      );
      await expect(seleccionar.ejecutar(a2.id, conductor)).rejects.toThrow(
        ReglaNegocioError,
      );
    });

    it('rechaza una ambulancia inexistente y un rol sin función', async () => {
      await expect(
        seleccionar.ejecutar('no-existe', conductor),
      ).rejects.toThrow(RecursoNoEncontradoError);
      await expect(
        seleccionar.ejecutar('no-existe', despachador),
      ).rejects.toThrow(AccesoDenegadoError);
    });

    it('si el turno ya tuvo servicios, lo cierra y sigue en uno nuevo', async () => {
      const ambulancia = await ambulanciaNueva();
      const anterior = await turnos.crear(
        crearTurnoPrueba(ambulancia.id, [
          { usuarioId: 'c1', funcion: 'conductor' },
          { usuarioId: 'p1', funcion: 'paramedico' },
        ]),
      );
      turnos.conServicios.add(anterior.id);

      const nuevo = await seleccionar.ejecutar(ambulancia.id, {
        ...paramedico,
        usuarioId: 'p2',
      });

      expect(nuevo.id).not.toBe(anterior.id);
      expect(nuevo.integrantes.map((i) => i.usuarioId)).toEqual([
        'c1',
        'p1',
        'p2',
      ]);
      expect(anterior.estado).toBe('finalizado');
      // Quien llega después no queda en el turno de los servicios anteriores.
      expect(anterior.incluyeA('p2')).toBe(false);
    });

    it('un tercero no reactiva una ambulancia que la central sacó de servicio', async () => {
      const ambulancia = await ambulanciaNueva();
      await turnos.crear(
        crearTurnoPrueba(ambulancia.id, [
          { usuarioId: 'c1', funcion: 'conductor' },
          { usuarioId: 'p1', funcion: 'paramedico' },
        ]),
      );

      await seleccionar.ejecutar(ambulancia.id, {
        ...paramedico,
        usuarioId: 'p2',
      });

      expect(ambulancia.estadoOperativo).toBe('fuera_servicio');
    });
  });

  describe('salir', () => {
    async function tripulada(): Promise<Ambulancia> {
      const ambulancia = await ambulanciaNueva();
      await seleccionar.ejecutar(ambulancia.id, conductor);
      await seleccionar.ejecutar(ambulancia.id, paramedico);
      return ambulancia;
    }

    it('conserva el turno cerrado, sigue con los demás y la saca de disponible', async () => {
      const ambulancia = await tripulada();
      const anterior = await turnos.buscarActivoDeAmbulancia(ambulancia.id);

      await salir.ejecutar(conductor);

      const siguiente = await turnos.buscarActivoDeAmbulancia(ambulancia.id);
      expect(anterior?.estado).toBe('finalizado');
      expect(anterior?.incluyeA('c1')).toBe(true);
      expect(siguiente?.id).not.toBe(anterior?.id);
      expect(siguiente?.integrantes.map((i) => i.usuarioId)).toEqual(['p1']);
      expect(ambulancia.estadoOperativo).toBe('fuera_servicio');
      expect(await turnos.buscarActivoDeUsuario('c1')).toBeNull();
    });

    it('sigue disponible si la tripulación sigue completa', async () => {
      const ambulancia = await tripulada();
      await seleccionar.ejecutar(ambulancia.id, {
        ...paramedico,
        usuarioId: 'p2',
      });

      await salir.ejecutar({ ...paramedico, usuarioId: 'p2' });

      expect(ambulancia.estadoOperativo).toBe('disponible');
    });

    it('al salir el último no queda turno activo', async () => {
      const ambulancia = await ambulanciaNueva();
      await seleccionar.ejecutar(ambulancia.id, conductor);

      await salir.ejecutar(conductor);

      expect(await turnos.buscarActivoDeAmbulancia(ambulancia.id)).toBeNull();
    });

    it('no deja salir con un servicio en curso', async () => {
      const ambulancia = await tripulada();
      await conEstado(ambulancia, 'en_servicio');

      await expect(salir.ejecutar(conductor)).rejects.toThrow(
        ReglaNegocioError,
      );
      expect(await turnos.buscarActivoDeUsuario('c1')).not.toBeNull();
    });

    it('sin ambulancia, salir no hace nada', async () => {
      await expect(salir.ejecutar(conductor)).resolves.toBeUndefined();
      expect(auditoria.eventos).toEqual([]);
    });
  });

  describe('opciones', () => {
    it('explica cuáles se pueden elegir según la función del usuario', async () => {
      const libre = await ambulanciaNueva('amb-01');
      const conConductor = await ambulanciaNueva('amb-02');
      const taller = await conEstado(
        await ambulanciaNueva('amb-03'),
        'mantenimiento',
      );
      await seleccionar.ejecutar(conConductor.id, {
        ...conductor,
        usuarioId: 'c2',
      });

      const paraConductor = await opciones.ejecutar(conductor);
      const paraParamedico = await opciones.ejecutar(paramedico);
      const motivo = (lista: typeof paraConductor, id: string) =>
        lista.find((o) => o.ambulancia.id === id)?.motivoNoSeleccionable;

      expect(motivo(paraConductor, libre.id)).toBeNull();
      expect(motivo(paraConductor, conConductor.id)).toBe('conductor_ocupado');
      expect(motivo(paraParamedico, conConductor.id)).toBeNull();
      expect(motivo(paraParamedico, taller.id)).toBe('mantenimiento');
    });

    it('marca la ambulancia propia', async () => {
      const ambulancia = await ambulanciaNueva();
      await seleccionar.ejecutar(ambulancia.id, conductor);

      const otra = await ambulanciaNueva('amb-02');

      const lista = await opciones.ejecutar(conductor);
      const propia = lista.find((o) => o.ambulancia.id === ambulancia.id);
      const ajena = lista.find((o) => o.ambulancia.id === otra.id);

      expect(propia?.esMia).toBe(true);
      expect(propia?.motivoNoSeleccionable).toBeNull();
      expect(ajena?.motivoNoSeleccionable).toBe('ya_en_otra_ambulancia');
    });
  });

  describe('la central cierra un turno abierto', () => {
    it('finaliza el turno y saca la ambulancia de disponible', async () => {
      const ambulancia = await ambulanciaNueva();
      await seleccionar.ejecutar(ambulancia.id, conductor);
      const turno = await seleccionar.ejecutar(ambulancia.id, paramedico);

      const cerrado = await finalizar.ejecutar(turno.id, despachador);

      expect(cerrado.estado).toBe('finalizado');
      expect(ambulancia.estadoOperativo).toBe('fuera_servicio');
    });

    it('no cierra un turno con la ambulancia en servicio', async () => {
      const ambulancia = await ambulanciaNueva();
      const turno = await seleccionar.ejecutar(ambulancia.id, conductor);
      await conEstado(ambulancia, 'en_servicio');

      await expect(finalizar.ejecutar(turno.id, despachador)).rejects.toThrow(
        ReglaNegocioError,
      );
    });
  });
});
