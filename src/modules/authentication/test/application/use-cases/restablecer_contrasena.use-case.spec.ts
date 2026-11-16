import {
  AuditoriaMemoria,
  HashFalso,
  SesionesMemoria,
  UsuariosMemoria,
  crearUsuarioPrueba,
} from '../../../../../../test/dobles/repositorios_memoria.js';
import {
  NoAutenticadoError,
  RecursoNoEncontradoError,
  ReglaNegocioError,
} from '../../../../../common/exceptions/errores_dominio.js';
import { RestablecerContrasena } from '../../../application/use-cases/restablecer_contrasena.use-case.js';
import { Sesion } from '../../../domain/entities/sesion.entity.js';

describe('RestablecerContrasena', () => {
  let usuarios: UsuariosMemoria;
  let sesiones: SesionesMemoria;
  let auditoria: AuditoriaMemoria;
  let restablecer: RestablecerContrasena;
  const administrador = { usuarioId: 'admin-1', direccionIp: '10.0.0.1' };

  beforeEach(() => {
    usuarios = new UsuariosMemoria();
    sesiones = new SesionesMemoria();
    auditoria = new AuditoriaMemoria();
    restablecer = new RestablecerContrasena(
      usuarios,
      sesiones,
      new HashFalso(),
      auditoria,
    );
  });

  async function conductorConSesion() {
    const usuario = await usuarios.crear(
      crearUsuarioPrueba({
        correo: 'pedro@galenos.co',
        rol: 'conductor',
        contrasena: 'Vieja20261',
      }),
    );
    const sesion = Sesion.crear({
      id: 'sesion-1',
      usuarioId: usuario.id,
      tokenHash: 'x',
      expiraEn: new Date(Date.now() + 3_600_000),
    });
    await sesiones.guardar(sesion);
    return usuario;
  }

  it('cambia la contraseña sin pedir la actual y cierra todas sus sesiones', async () => {
    const usuario = await conductorConSesion();

    await restablecer.ejecutar(usuario.id, 'Nueva2026abc', administrador);

    expect((await usuarios.buscarPorId(usuario.id))?.contrasenaHash).toBe(
      'hash:Nueva2026abc',
    );
    expect(sesiones.revocadas.has('sesion-1')).toBe(true);
  });

  it('audita quién lo hizo, sin la contraseña', async () => {
    const usuario = await conductorConSesion();

    await restablecer.ejecutar(usuario.id, 'Nueva2026abc', administrador);

    const evento = auditoria.eventos.at(-1);
    expect(evento).toMatchObject({
      usuarioId: 'admin-1',
      entidad: 'usuarios',
      entidadId: usuario.id,
      accion: 'restablecer_contrasena',
      direccionIp: '10.0.0.1',
    });
    expect(JSON.stringify(evento)).not.toContain('Nueva2026abc');
  });

  it('el administrador no restablece su propia contraseña por aquí', async () => {
    const usuario = await conductorConSesion();

    await expect(
      restablecer.ejecutar(usuario.id, 'Nueva2026abc', {
        usuarioId: usuario.id,
        direccionIp: null,
      }),
    ).rejects.toThrow(ReglaNegocioError);
    expect(sesiones.revocadas.size).toBe(0);
  });

  it('404 si el usuario no existe y 401 sin sesión', async () => {
    await expect(
      restablecer.ejecutar('no-existe', 'Nueva2026abc', administrador),
    ).rejects.toThrow(RecursoNoEncontradoError);
    await expect(
      restablecer.ejecutar('x', 'Nueva2026abc', {
        usuarioId: null,
        direccionIp: null,
      }),
    ).rejects.toThrow(NoAutenticadoError);
  });
});
