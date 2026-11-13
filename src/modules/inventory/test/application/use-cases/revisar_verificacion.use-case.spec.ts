import { AuditoriaMemoria } from '../../../../../../test/dobles/repositorios_memoria.js';
import {
  ConflictoNegocioError,
  NoAutenticadoError,
  RecursoNoEncontradoError,
} from '../../../../../common/exceptions/errores_dominio.js';
import { AuditoriaInventario } from '../../../application/services/auditoria_inventario.service.js';
import { RevisarVerificacion } from '../../../application/use-cases/revisar_verificacion.use-case.js';
import { Verificacion } from '../../../domain/entities/verificacion.entity.js';
import { AHORA, HOY, crearInsumo } from '../../dobles/fabricas_inventario.js';
import { VerificacionesMemoria } from '../../dobles/verificaciones_memoria.js';

const central = { usuarioId: 'despachador-1', direccionIp: '10.0.0.5' };

function verificacionConNovedades(): Verificacion {
  const verificacion = Verificacion.iniciar(
    {
      ubicacionId: 'ubi-1',
      turnoId: 't-1',
      responsableId: 'paramedico-1',
      tipo: 'inicio_turno',
      observaciones: null,
    },
    AHORA,
  );
  verificacion.registrarConteo(
    {
      insumo: crearInsumo(),
      lote: null,
      equipo: null,
      cantidadEncontrada: 3,
      estado: null,
      observaciones: null,
    },
    { cantidadEsperada: 5, perfilDetalleId: null, hoy: HOY },
    AHORA,
  );
  verificacion.finalizar([], null, AHORA);
  return verificacion;
}

describe('RevisarVerificacion', () => {
  let verificaciones: VerificacionesMemoria;
  let auditoria: AuditoriaMemoria;
  let revisar: RevisarVerificacion;

  beforeEach(() => {
    verificaciones = new VerificacionesMemoria();
    auditoria = new AuditoriaMemoria();
    revisar = new RevisarVerificacion(
      verificaciones,
      new AuditoriaInventario(auditoria),
    );
  });

  it('registra quién la revisó y lo deja en auditoría', async () => {
    const pendiente = verificacionConNovedades();
    await verificaciones.crear(pendiente);

    const revisada = await revisar.ejecutar(
      pendiente.id,
      'Repuesto con MOV-1',
      central,
      AHORA,
    );

    expect(revisada.revision).toMatchObject({
      revisadaPorId: 'despachador-1',
      resolucion: 'Repuesto con MOV-1',
    });
    expect(auditoria.eventos.at(-1)).toMatchObject({
      entidad: 'inv_verificaciones',
      accion: 'revisar',
      usuarioId: 'despachador-1',
      detalle: { novedades: 1, resolucion: 'Repuesto con MOV-1' },
    });
    const { datos } = await verificaciones.listar(
      { revisada: false },
      { pagina: 1, limite: 10 },
    );
    expect(datos).toHaveLength(0);
  });

  it('404 si no existe y 401 sin usuario', async () => {
    await expect(revisar.ejecutar('no-existe', 'x', central)).rejects.toThrow(
      RecursoNoEncontradoError,
    );
    await expect(
      revisar.ejecutar('no-existe', 'x', {
        usuarioId: null,
        direccionIp: null,
      }),
    ).rejects.toThrow(NoAutenticadoError);
  });

  it('409 si otra persona la revisó al mismo tiempo, sin dejar auditoría', async () => {
    const pendiente = verificacionConNovedades();
    await verificaciones.crear(pendiente);
    verificaciones.revisadasPorOtro.add(pendiente.id);

    await expect(
      revisar.ejecutar(pendiente.id, 'Repuesto', central),
    ).rejects.toThrow(ConflictoNegocioError);
    expect(auditoria.eventos).toHaveLength(0);
  });
});
