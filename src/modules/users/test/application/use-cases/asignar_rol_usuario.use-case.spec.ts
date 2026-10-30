import {
  AuditoriaMemoria,
  UsuariosMemoria,
  crearUsuarioPrueba,
} from '../../../../../../test/dobles/repositorios_memoria.js';
import { ReglaNegocioError } from '../../../../../common/exceptions/errores_dominio.js';
import { AsignarRolUsuario } from '../../../application/use-cases/asignar_rol_usuario.use-case.js';

describe('AsignarRolUsuario', () => {
  let usuarios: UsuariosMemoria;
  let asignarRol: AsignarRolUsuario;

  beforeEach(() => {
    usuarios = new UsuariosMemoria();
    asignarRol = new AsignarRolUsuario(usuarios, new AuditoriaMemoria());
  });

  it('reemplaza el rol del usuario', async () => {
    const usuario = await usuarios.crear(crearUsuarioPrueba());

    const actualizado = await asignarRol.ejecutar(usuario.id, 'paramedico', {
      usuarioId: 'otro-admin',
      direccionIp: null,
    });

    expect(actualizado.rol).toBe('paramedico');
  });

  it('rechaza roles inexistentes', async () => {
    const usuario = await usuarios.crear(crearUsuarioPrueba());

    await expect(
      asignarRol.ejecutar(usuario.id, 'obsoleto', {
        usuarioId: 'otro-admin',
        direccionIp: null,
      }),
    ).rejects.toThrow(ReglaNegocioError);
    expect(usuario.rol).toBe('despachador');
  });

  it('impide que un administrador se retire su propio rol', async () => {
    const admin = await usuarios.crear(
      crearUsuarioPrueba({ rol: 'administrador' }),
    );

    await expect(
      asignarRol.ejecutar(admin.id, 'despachador', {
        usuarioId: admin.id,
        direccionIp: null,
      }),
    ).rejects.toThrow(ReglaNegocioError);
    expect(admin.rol).toBe('administrador');
  });
});
