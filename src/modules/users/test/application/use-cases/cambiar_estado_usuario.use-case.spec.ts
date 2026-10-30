import {
  AuditoriaMemoria,
  UsuariosMemoria,
  crearUsuarioPrueba,
} from '../../../../../../test/dobles/repositorios_memoria.js';
import {
  RecursoNoEncontradoError,
  ReglaNegocioError,
} from '../../../../../common/exceptions/errores_dominio.js';
import { CambiarEstadoUsuario } from '../../../application/use-cases/cambiar_estado_usuario.use-case.js';

describe('CambiarEstadoUsuario', () => {
  let usuarios: UsuariosMemoria;
  let auditoria: AuditoriaMemoria;
  let cambiarEstado: CambiarEstadoUsuario;
  const contexto = { usuarioId: 'admin-1', direccionIp: null };

  beforeEach(() => {
    usuarios = new UsuariosMemoria();
    auditoria = new AuditoriaMemoria();
    cambiarEstado = new CambiarEstadoUsuario(usuarios, auditoria);
  });

  it('bloquea al usuario y registra el motivo', async () => {
    const usuario = await usuarios.crear(crearUsuarioPrueba());

    const resultado = await cambiarEstado.ejecutar(
      { usuarioId: usuario.id, estado: 'bloqueado', motivo: 'Uso indebido' },
      contexto,
    );

    expect(resultado.estado).toBe('bloqueado');
    expect(auditoria.eventos[0]?.detalle).toEqual({
      estadoAnterior: 'activo',
      estadoNuevo: 'bloqueado',
      motivo: 'Uso indebido',
    });
  });

  it('impide cambiar el estado propio', async () => {
    await expect(
      cambiarEstado.ejecutar(
        { usuarioId: 'admin-1', estado: 'inactivo', motivo: 'Prueba' },
        contexto,
      ),
    ).rejects.toThrow(ReglaNegocioError);
  });

  it('falla si el usuario no existe', async () => {
    await expect(
      cambiarEstado.ejecutar(
        { usuarioId: 'no-existe', estado: 'inactivo', motivo: 'Prueba' },
        contexto,
      ),
    ).rejects.toThrow(RecursoNoEncontradoError);
  });
});
