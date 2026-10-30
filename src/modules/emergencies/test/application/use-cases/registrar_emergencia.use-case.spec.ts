import { EmergenciasMemoria } from '../../../../../../test/dobles/emergencias_memoria.js';
import { PublicadorEventosMemoria } from '../../../../../../test/dobles/publicador_eventos_memoria.js';
import { AuditoriaMemoria } from '../../../../../../test/dobles/repositorios_memoria.js';
import { ConflictoNegocioError } from '../../../../../common/exceptions/errores_dominio.js';
import { Emergencia } from '../../../domain/entities/emergencia.entity.js';
import { RegistrarEmergencia } from '../../../application/use-cases/registrar_emergencia.use-case.js';

describe('RegistrarEmergencia', () => {
  const contexto = { usuarioId: 'despachador-1', direccionIp: null };
  const datos = {
    fuente: 'linea_123' as const,
    descripcion: 'Choque entre moto y carro',
    direccion: 'Calle 72 # 15-20',
  };
  let emergencias: EmergenciasMemoria;
  let auditoria: AuditoriaMemoria;
  let eventos: PublicadorEventosMemoria;
  let registrar: RegistrarEmergencia;

  beforeEach(() => {
    emergencias = new EmergenciasMemoria();
    auditoria = new AuditoriaMemoria();
    eventos = new PublicadorEventosMemoria();
    registrar = new RegistrarEmergencia(emergencias, auditoria, eventos);
  });

  it('asigna consecutivos del día, guarda quién la recibió y la audita', async () => {
    const primera = await registrar.ejecutar(datos, contexto);
    const segunda = await registrar.ejecutar(datos, contexto);
    const prefijo = Emergencia.prefijoNumero(new Date());

    expect(primera.numeroEmergencia).toBe(`${prefijo}0001`);
    expect(segunda.numeroEmergencia).toBe(`${prefijo}0002`);
    expect(primera.recibidaPorId).toBe('despachador-1');
    expect(auditoria.eventos[0]?.accion).toBe('crear');
  });

  it('publica emergencia.creada solo después de guardarla', async () => {
    emergencias.colisionesPendientes = 1;

    const emergencia = await registrar.ejecutar(datos, contexto);

    expect(eventos.eventos).toEqual([
      { tipo: 'emergencia.creada', emergenciaId: emergencia.id },
    ]);
  });

  it('reintenta si otro despachador tomó el mismo número', async () => {
    emergencias.colisionesPendientes = 2;

    const emergencia = await registrar.ejecutar(datos, contexto);

    expect(emergencia.estado).toBe('recibida');
  });

  it('se rinde después de tres choques seguidos', async () => {
    emergencias.colisionesPendientes = 3;

    await expect(registrar.ejecutar(datos, contexto)).rejects.toThrow(
      ConflictoNegocioError,
    );
    expect(eventos.eventos).toHaveLength(0);
  });
});
