import { AuditoriaMemoria } from '../../../../../../test/dobles/repositorios_memoria.js';
import {
  ConflictoNegocioError,
  RecursoNoEncontradoError,
} from '../../../../../common/exceptions/errores_dominio.js';
import { CambiarEstadoListaChequeo } from '../../../application/use-cases/cambiar_estado_lista_chequeo.use-case.js';
import { ConsultarListasChequeo } from '../../../application/use-cases/consultar_listas_chequeo.use-case.js';
import { CrearListaChequeo } from '../../../application/use-cases/crear_lista_chequeo.use-case.js';
import { GestionarPreguntasListaChequeo } from '../../../application/use-cases/gestionar_preguntas_lista_chequeo.use-case.js';
import { ListasChequeoMemoria } from '../../dobles/listas_chequeo_memoria.js';

const administrador = { usuarioId: 'admin-1', direccionIp: '10.0.0.1' };
const datos = {
  nombre: 'Chequeo diario',
  items: [{ pregunta: '¿Aceite?' }, { pregunta: '¿Luces?' }],
  estados: [{ nombre: 'Bien' }, { nombre: 'Regular' }, { nombre: 'Estable' }],
};

describe('Configuración de listas de chequeo', () => {
  let listas: ListasChequeoMemoria;
  let auditoria: AuditoriaMemoria;
  let crear: CrearListaChequeo;
  let cambiarEstado: CambiarEstadoListaChequeo;
  let preguntas: GestionarPreguntasListaChequeo;

  beforeEach(() => {
    listas = new ListasChequeoMemoria();
    auditoria = new AuditoriaMemoria();
    const consultar = new ConsultarListasChequeo(listas);
    crear = new CrearListaChequeo(listas, auditoria);
    cambiarEstado = new CambiarEstadoListaChequeo(consultar, listas, auditoria);
    preguntas = new GestionarPreguntasListaChequeo(
      consultar,
      listas,
      auditoria,
    );
  });

  it('crea la lista y la audita', async () => {
    const lista = await crear.ejecutar(datos, administrador);

    expect(lista.creadaPorId).toBe('admin-1');
    expect(auditoria.eventos.at(-1)).toEqual(
      expect.objectContaining({
        entidad: 'listas_chequeo',
        accion: 'crear',
        detalle: {
          nombre: 'Chequeo diario',
          totalPreguntas: 2,
          totalOpciones: 3,
        },
      }),
    );
  });

  it('solo queda una lista activa', async () => {
    const primera = await crear.ejecutar(datos, administrador);
    const segunda = await crear.ejecutar(
      { ...datos, nombre: 'Otra' },
      administrador,
    );

    await cambiarEstado.ejecutar(primera.id, true, administrador);
    await cambiarEstado.ejecutar(segunda.id, true, administrador);

    expect([...listas.listas.values()].filter((l) => l.activa)).toEqual([
      segunda,
    ]);
  });

  it('el texto de una pregunta ya respondida no se cambia', async () => {
    const lista = await crear.ejecutar(datos, administrador);
    const itemId = lista.items[0]?.id ?? '';
    listas.itemsConRespuestas.add(itemId);

    await expect(
      preguntas.actualizar(
        lista.id,
        itemId,
        { pregunta: '¿Otra?' },
        administrador,
      ),
    ).rejects.toThrow(ConflictoNegocioError);
    // Lo demás sí se puede cambiar (por ejemplo, desactivarla).
    const actualizada = await preguntas.actualizar(
      lista.id,
      itemId,
      { activo: false },
      administrador,
    );
    expect(actualizada.itemsActivos()).toHaveLength(1);
  });

  it('una lista inexistente responde 404', async () => {
    await expect(
      cambiarEstado.ejecutar('no-existe', true, administrador),
    ).rejects.toThrow(RecursoNoEncontradoError);
  });
});
