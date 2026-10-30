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
import {
  RecursoNoEncontradoError,
  ReglaNegocioError,
} from '../../../../../common/exceptions/errores_dominio.js';
import { CambiarEstadoAmbulancia } from '../../../application/use-cases/cambiar_estado_ambulancia.use-case.js';

describe('CambiarEstadoAmbulancia', () => {
  const contexto = { usuarioId: 'despachador-1', direccionIp: null };
  let ambulancias: AmbulanciasMemoria;
  let turnos: TurnosMemoria;
  let eventos: PublicadorEventosMemoria;
  let cambiarEstado: CambiarEstadoAmbulancia;

  beforeEach(() => {
    ambulancias = new AmbulanciasMemoria();
    turnos = new TurnosMemoria();
    eventos = new PublicadorEventosMemoria();
    cambiarEstado = new CambiarEstadoAmbulancia(
      ambulancias,
      turnos,
      new AuditoriaMemoria(),
      eventos,
    );
  });

  it('cambia el estado y deja el historial', async () => {
    const ambulancia = await ambulancias.crear(crearAmbulanciaPrueba());
    await turnos.crear(crearTurnoPrueba(ambulancia.id));

    const resultado = await cambiarEstado.ejecutar(
      {
        ambulanciaId: ambulancia.id,
        estado: 'disponible',
        motivo: 'Inicio de turno',
      },
      contexto,
    );

    expect(resultado.estadoOperativo).toBe('disponible');
    expect(ambulancias.historial).toEqual([
      expect.objectContaining({
        estadoAnterior: 'fuera_servicio',
        estadoNuevo: 'disponible',
        usuarioId: 'despachador-1',
      }),
    ]);
    expect(eventos.eventos).toEqual([
      { tipo: 'ambulancia.actualizada', ambulanciaId: ambulancia.id },
    ]);
  });

  it('no registra historial si la transición no es válida', async () => {
    const ambulancia = await ambulancias.crear(crearAmbulanciaPrueba());

    await expect(
      cambiarEstado.ejecutar(
        {
          ambulanciaId: ambulancia.id,
          estado: 'fuera_servicio',
          motivo: 'Prueba',
        },
        contexto,
      ),
    ).rejects.toThrow(ReglaNegocioError);
    expect(ambulancias.historial).toHaveLength(0);
    expect(eventos.eventos).toHaveLength(0);
  });

  it('no deja habilitar una ambulancia sin turno activo', async () => {
    const ambulancia = await ambulancias.crear(crearAmbulanciaPrueba());

    await expect(
      cambiarEstado.ejecutar(
        {
          ambulanciaId: ambulancia.id,
          estado: 'disponible',
          motivo: 'Inicio de turno',
        },
        contexto,
      ),
    ).rejects.toThrow(ReglaNegocioError);
    expect(ambulancias.historial).toHaveLength(0);
  });

  it('falla si la ambulancia no existe', async () => {
    await expect(
      cambiarEstado.ejecutar(
        { ambulanciaId: 'no-existe', estado: 'disponible', motivo: 'Prueba' },
        contexto,
      ),
    ).rejects.toThrow(RecursoNoEncontradoError);
  });
});
