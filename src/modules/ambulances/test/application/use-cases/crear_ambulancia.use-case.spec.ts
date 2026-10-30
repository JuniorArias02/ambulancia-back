import {
  AmbulanciasMemoria,
  TiposAmbulanciaMemoria,
  crearAmbulanciaPrueba,
} from '../../../../../../test/dobles/ambulancias_memoria.js';
import { PublicadorEventosMemoria } from '../../../../../../test/dobles/publicador_eventos_memoria.js';
import { AuditoriaMemoria } from '../../../../../../test/dobles/repositorios_memoria.js';
import {
  ConflictoNegocioError,
  ReglaNegocioError,
} from '../../../../../common/exceptions/errores_dominio.js';
import { CrearAmbulancia } from '../../../application/use-cases/crear_ambulancia.use-case.js';

describe('CrearAmbulancia', () => {
  const contexto = { usuarioId: 'admin-1', direccionIp: null };
  let ambulancias: AmbulanciasMemoria;
  let auditoria: AuditoriaMemoria;
  let crearAmbulancia: CrearAmbulancia;

  beforeEach(() => {
    ambulancias = new AmbulanciasMemoria();
    auditoria = new AuditoriaMemoria();
    crearAmbulancia = new CrearAmbulancia(
      ambulancias,
      new TiposAmbulanciaMemoria(),
      auditoria,
      new PublicadorEventosMemoria(),
    );
  });

  it('crea la ambulancia y la audita', async () => {
    const ambulancia = await crearAmbulancia.ejecutar(
      { codigo: 'amb-02', placa: 'xyz-987', tipoAmbulanciaId: 't2' },
      contexto,
    );

    expect(ambulancia.placa).toBe('XYZ987');
    expect(ambulancia.tipo.nombre).toBe('TAM');
    expect(auditoria.eventos[0]?.accion).toBe('crear');
  });

  it('rechaza una placa repetida aunque se escriba distinto', async () => {
    await ambulancias.crear(crearAmbulanciaPrueba({ placa: 'ABC123' }));

    await expect(
      crearAmbulancia.ejecutar(
        { codigo: 'amb-02', placa: 'abc 123', tipoAmbulanciaId: 't1' },
        contexto,
      ),
    ).rejects.toThrow(ConflictoNegocioError);
  });

  it('rechaza un tipo inexistente', async () => {
    await expect(
      crearAmbulancia.ejecutar(
        { codigo: 'amb-02', placa: 'xyz987', tipoAmbulanciaId: 'no-existe' },
        contexto,
      ),
    ).rejects.toThrow(ReglaNegocioError);
  });
});
