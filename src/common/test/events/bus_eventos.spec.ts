import { BusEventos } from '../../events/bus_eventos.js';
import type { EventoDominio } from '../../events/eventos_dominio.js';

describe('BusEventos', () => {
  const evento: EventoDominio = {
    tipo: 'ambulancia.actualizada',
    ambulanciaId: 'amb-1',
  };

  it('no hace esperar al publicador', () => {
    const bus = new BusEventos();
    const recibidos: EventoDominio[] = [];
    bus.suscribir((e) => {
      recibidos.push(e);
      return Promise.resolve();
    });

    bus.publicar(evento);

    expect(recibidos).toHaveLength(0);
  });

  it('un suscriptor que falla no afecta a los demás', async () => {
    const bus = new BusEventos();
    const recibidos: EventoDominio[] = [];
    bus.suscribir(() => Promise.reject(new Error('falló')));
    bus.suscribir(() => {
      throw new Error('falló sin promesa');
    });
    bus.suscribir((e) => {
      recibidos.push(e);
      return Promise.resolve();
    });

    expect(() => bus.publicar(evento)).not.toThrow();
    await vi.waitFor(() => expect(recibidos).toEqual([evento]));
  });
});
