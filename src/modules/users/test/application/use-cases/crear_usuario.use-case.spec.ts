import {
  AuditoriaMemoria,
  HashFalso,
  UsuariosMemoria,
  crearUsuarioPrueba,
} from '../../../../../../test/dobles/repositorios_memoria.js';
import {
  ConflictoNegocioError,
  ReglaNegocioError,
} from '../../../../../common/exceptions/errores_dominio.js';
import { CrearUsuario } from '../../../application/use-cases/crear_usuario.use-case.js';

describe('CrearUsuario', () => {
  const contexto = { usuarioId: 'admin-1', direccionIp: '10.0.0.1' };
  let usuarios: UsuariosMemoria;
  let auditoria: AuditoriaMemoria;
  let crearUsuario: CrearUsuario;

  beforeEach(() => {
    usuarios = new UsuariosMemoria();
    auditoria = new AuditoriaMemoria();
    crearUsuario = new CrearUsuario(usuarios, new HashFalso(), auditoria);
  });

  const entrada = {
    nombres: 'Laura',
    apellidos: 'Gómez',
    correo: 'Laura@Galenos.co',
    contrasena: 'Secreta2026',
    rol: 'despachador',
  };

  it('crea el usuario con la contraseña hasheada y lo audita', async () => {
    const usuario = await crearUsuario.ejecutar(entrada, contexto);

    expect(usuario.correo).toBe('laura@galenos.co');
    expect(usuario.contrasenaHash).toBe('hash:Secreta2026');
    expect(usuarios.usuarios.size).toBe(1);
    expect(auditoria.eventos).toEqual([
      expect.objectContaining({
        accion: 'crear',
        entidadId: usuario.id,
        usuarioId: 'admin-1',
      }),
    ]);
  });

  it('rechaza un correo ya registrado sin distinguir mayúsculas', async () => {
    await usuarios.crear(crearUsuarioPrueba({ correo: 'laura@galenos.co' }));

    await expect(crearUsuario.ejecutar(entrada, contexto)).rejects.toThrow(
      ConflictoNegocioError,
    );
  });

  it('rechaza roles inexistentes', async () => {
    await expect(
      crearUsuario.ejecutar({ ...entrada, rol: 'obsoleto' }, contexto),
    ).rejects.toThrow(ReglaNegocioError);
    expect(usuarios.usuarios.size).toBe(0);
  });
});
