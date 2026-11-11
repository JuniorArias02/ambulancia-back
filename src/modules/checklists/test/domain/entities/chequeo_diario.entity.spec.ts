import { ReglaNegocioError } from '../../../../../common/exceptions/errores_dominio.js';
import { ChequeoDiario } from '../../../domain/entities/chequeo_diario.entity.js';
import type { ListaChequeo } from '../../../domain/entities/lista_chequeo.entity.js';
import { crearListaPrueba } from '../../dobles/listas_chequeo_memoria.js';

describe('ChequeoDiario', () => {
  let lista: ListaChequeo;
  let chequeo: ChequeoDiario;
  const ahora = new Date('2026-11-10T15:00:00Z');

  const aceite = () => lista.items[0]?.id ?? '';
  const luces = () => lista.items[1]?.id ?? '';
  const bien = () => lista.estados[0]?.id ?? '';

  beforeEach(() => {
    lista = crearListaPrueba();
    chequeo = ChequeoDiario.iniciar({
      listaChequeoId: lista.id,
      conductorId: 'conductor-1',
      ambulanciaId: 'amb-1',
      ahora,
    });
  });

  it('nace en borrador con el día de Colombia', () => {
    expect(chequeo.estado).toBe('borrador');
    expect(chequeo.fecha).toBe('2026-11-10');
    // 03:00 UTC del 10 todavía es el 9 en Colombia (UTC-5).
    expect(ChequeoDiario.fechaDelDia(new Date('2026-11-10T03:00:00Z'))).toBe(
      '2026-11-09',
    );
  });

  it('responder otra vez la misma pregunta la reemplaza', () => {
    const [, regular] = lista.estados;
    chequeo.responder(
      lista,
      { itemId: aceite(), estadoId: bien(), tieneObservacion: false },
      ahora,
    );
    chequeo.responder(
      lista,
      {
        itemId: aceite(),
        estadoId: regular?.id ?? '',
        tieneObservacion: false,
      },
      ahora,
    );

    expect(chequeo.respuestas).toHaveLength(1);
    expect(chequeo.respuestas[0]?.estadoId).toBe(regular?.id);
  });

  it('rechaza una opción de otra lista o una pregunta ajena', () => {
    const otra = crearListaPrueba();
    expect(() =>
      chequeo.responder(
        lista,
        {
          itemId: aceite(),
          estadoId: otra.estados[0]?.id ?? '',
          tieneObservacion: false,
        },
        ahora,
      ),
    ).toThrow(ReglaNegocioError);
    expect(() =>
      chequeo.responder(
        lista,
        {
          itemId: otra.items[0]?.id ?? '',
          estadoId: bien(),
          tieneObservacion: false,
        },
        ahora,
      ),
    ).toThrow('no pertenece');
  });

  it('valida la observación', () => {
    expect(() =>
      chequeo.responder(
        lista,
        { itemId: aceite(), estadoId: bien(), tieneObservacion: true },
        ahora,
      ),
    ).toThrow('Escriba la observación');
    expect(() =>
      chequeo.responder(
        lista,
        {
          itemId: luces(),
          estadoId: bien(),
          tieneObservacion: true,
          observacion: 'x',
        },
        ahora,
      ),
    ).toThrow('no admite observaciones');

    const sinMarcar = chequeo.responder(
      lista,
      {
        itemId: aceite(),
        estadoId: bien(),
        tieneObservacion: false,
        observacion: 'se ignora',
      },
      ahora,
    );
    expect(sinMarcar.observacion).toBeNull();
  });

  it('no finaliza con preguntas obligatorias pendientes', () => {
    chequeo.responder(
      lista,
      { itemId: aceite(), estadoId: bien(), tieneObservacion: false },
      ahora,
    );

    expect(chequeo.pendientes(lista).map((i) => i.id)).toEqual([luces()]);
    expect(() => chequeo.finalizar(lista, ahora)).toThrow(
      '¿Luces y sirena funcionan?',
    );
  });

  it('finalizado ya no cambia', () => {
    for (const itemId of [aceite(), luces()]) {
      chequeo.responder(
        lista,
        { itemId, estadoId: bien(), tieneObservacion: false },
        ahora,
      );
    }
    chequeo.finalizar(lista, ahora);

    expect(chequeo.estado).toBe('finalizado');
    expect(chequeo.finalizadoEn).toEqual(ahora);
    expect(() =>
      chequeo.responder(
        lista,
        { itemId: aceite(), estadoId: bien(), tieneObservacion: false },
        ahora,
      ),
    ).toThrow('ya fue finalizado');
    expect(() => chequeo.finalizar(lista, ahora)).toThrow(ReglaNegocioError);
  });
});
