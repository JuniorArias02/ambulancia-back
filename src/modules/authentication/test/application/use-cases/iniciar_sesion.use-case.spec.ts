import {
  AuditoriaMemoria,
  EmisorTokensFalso,
  HashFalso,
  SesionesMemoria,
  UsuariosMemoria,
  crearUsuarioPrueba,
} from '../../../../../../test/dobles/repositorios_memoria.js';
import { NoAutenticadoError } from '../../../../../common/exceptions/errores_dominio.js';
import { IniciarSesion } from '../../../application/use-cases/iniciar_sesion.use-case.js';

describe('IniciarSesion', () => {
  let usuarios: UsuariosMemoria;
  let sesiones: SesionesMemoria;
  let auditoria: AuditoriaMemoria;
  let iniciarSesion: IniciarSesion;

  beforeEach(() => {
    usuarios = new UsuariosMemoria();
    sesiones = new SesionesMemoria();
    auditoria = new AuditoriaMemoria();
    iniciarSesion = new IniciarSesion(
      usuarios,
      sesiones,
      new HashFalso(),
      new EmisorTokensFalso(),
      auditoria,
    );
  });

  it('emite un token y persiste la sesión con credenciales válidas', async () => {
    const usuario = await usuarios.crear(crearUsuarioPrueba());

    const resultado = await iniciarSesion.ejecutar({
      correo: ' LAURA@galenos.co',
      contrasena: 'Secreta2026',
      direccionIp: '10.0.0.1',
    });

    expect(resultado.usuario.id).toBe(usuario.id);
    expect(resultado.usuario.rol).toBe('despachador');
    expect(sesiones.sesiones.size).toBe(1);
    expect(auditoria.eventos.at(-1)?.accion).toBe('iniciar_sesion');
  });

  it.each([
    ['contraseña incorrecta', 'laura@galenos.co', 'Incorrecta2026'],
    ['correo inexistente', 'nadie@galenos.co', 'Secreta2026'],
  ])('rechaza con error genérico: %s', async (_caso, correo, contrasena) => {
    await usuarios.crear(crearUsuarioPrueba());

    await expect(
      iniciarSesion.ejecutar({ correo, contrasena, direccionIp: null }),
    ).rejects.toThrow(new NoAutenticadoError());
    expect(sesiones.sesiones.size).toBe(0);
    expect(auditoria.eventos.at(-1)?.accion).toBe('inicio_sesion_fallido');
  });

  it('rechaza usuarios bloqueados aunque la contraseña sea correcta', async () => {
    const usuario = await usuarios.crear(crearUsuarioPrueba());
    usuario.cambiarEstado('bloqueado');

    await expect(
      iniciarSesion.ejecutar({
        correo: 'laura@galenos.co',
        contrasena: 'Secreta2026',
        direccionIp: null,
      }),
    ).rejects.toThrow(NoAutenticadoError);
    expect(auditoria.eventos.at(-1)?.detalle).toEqual({
      motivo: 'usuario_bloqueado',
    });
  });
});
