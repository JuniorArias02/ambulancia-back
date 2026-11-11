import { ReglaNegocioError } from '../../../../../common/exceptions/errores_dominio.js';
import { ListaChequeo } from '../../../domain/entities/lista_chequeo.entity.js';
import { crearListaPrueba } from '../../dobles/listas_chequeo_memoria.js';

const base = {
  nombre: 'Chequeo diario',
  creadaPorId: 'admin-1',
  fecha: new Date(),
};

describe('ListaChequeo', () => {
  it('nace inactiva, con sus preguntas y opciones en orden', () => {
    const lista = crearListaPrueba();

    expect(lista.activa).toBe(false);
    expect(lista.itemsActivos().map((i) => i.orden)).toEqual([0, 1]);
    expect(lista.estadosActivos().map((e) => e.nombre)).toEqual([
      'Bien',
      'Regular',
      'Estable',
    ]);
    expect(lista.items[0]?.obligatorio).toBe(true);
  });

  it('exige al menos una pregunta y dos opciones', () => {
    expect(() =>
      ListaChequeo.crear({
        ...base,
        items: [],
        estados: [{ nombre: 'Bien' }, { nombre: 'Mal' }],
      }),
    ).toThrow(ReglaNegocioError);
    expect(() =>
      ListaChequeo.crear({
        ...base,
        items: [{ pregunta: '¿Aceite?' }],
        estados: [{ nombre: 'Bien' }],
      }),
    ).toThrow(ReglaNegocioError);
  });

  it('no repite preguntas ni opciones (sin importar mayúsculas ni espacios)', () => {
    expect(() =>
      ListaChequeo.crear({
        ...base,
        items: [{ pregunta: '¿Aceite?' }, { pregunta: '  ¿ACEITE? ' }],
        estados: [{ nombre: 'Bien' }, { nombre: 'Mal' }],
      }),
    ).toThrow('ya está en la lista');
    expect(() => crearListaPrueba().agregarEstado({ nombre: 'bien' })).toThrow(
      ReglaNegocioError,
    );
  });

  it('rechaza textos vacíos o demasiado largos', () => {
    expect(() => crearListaPrueba().agregarItem({ pregunta: '   ' })).toThrow(
      'La pregunta es obligatorio',
    );
    expect(() =>
      crearListaPrueba().agregarItem({ pregunta: 'x'.repeat(501) }),
    ).toThrow('máximo 500');
  });

  it('desactivar una pregunta la saca de las activas sin borrarla', () => {
    const lista = crearListaPrueba();
    const [primera] = lista.items;

    lista.actualizarItem(primera?.id ?? '', { activo: false });

    expect(lista.items).toHaveLength(2);
    expect(lista.itemsActivos()).toHaveLength(1);
  });

  it('no deja sin preguntas activas ni con menos de dos opciones', () => {
    const lista = crearListaPrueba();
    const [primera, segunda] = lista.items;
    lista.actualizarItem(primera?.id ?? '', { activo: false });
    expect(() =>
      lista.actualizarItem(segunda?.id ?? '', { activo: false }),
    ).toThrow(ReglaNegocioError);

    const [bien, regular] = lista.estados;
    lista.actualizarEstado(bien?.id ?? '', { activo: false });
    expect(() =>
      lista.actualizarEstado(regular?.id ?? '', { activo: false }),
    ).toThrow(ReglaNegocioError);
  });
});
