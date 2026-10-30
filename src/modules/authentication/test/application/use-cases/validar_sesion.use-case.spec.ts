import {
  SesionesMemoria,
  UsuariosMemoria,
  crearUsuarioPrueba,
} from '../../../../../../test/dobles/repositorios_memoria.js';
import { NoAutenticadoError } from '../../../../../common/exceptions/errores_dominio.js';
import { Sesion } from '../../../domain/entities/sesion.entity.js';
import { ValidarSesion } from '../../../application/use-cases/validar_sesion.use-case.js';

describe('ValidarSesion', () => {
  let usuarios: UsuariosMemoria;
  let sesiones: SesionesMemoria;
  let validarSesion: ValidarSesion;

  beforeEach(() => {
    usuarios = new UsuariosMemoria();
    sesiones = new SesionesMemoria();
    validarSesion = new ValidarSesion(sesiones, usuarios);
  });

  async function prepararSesion(
    cambios: Partial<{ expiraEn: Date; revocadaEn: Date | null }> = {},
  ) {
    const usuario = await usuarios.crear(crearUsuarioPrueba());
    const sesion = Sesion.reconstruir({
      id: 'sesion-1',
      usuarioId: usuario.id,
      tokenHash: 'huella',
      expiraEn: cambios.expiraEn ?? new Date(Date.now() + 60_000),
      revocadaEn: cambios.revocadaEn ?? null,
      creadaEn: new Date(),
    });
    await sesiones.guardar(sesion);
    return { usuario, sesion };
  }

  it('devuelve el usuario autenticado para una sesión vigente', async () => {
    const { usuario } = await prepararSesion();

    const autenticado = await validarSesion.ejecutar({
      usuarioId: usuario.id,
      sesionId: 'sesion-1',
    });

    expect(autenticado).toMatchObject({
      id: usuario.id,
      rol: 'despachador',
      sesionId: 'sesion-1',
    });
  });

  it('rechaza sesiones revocadas', async () => {
    const { usuario } = await prepararSesion({ revocadaEn: new Date() });

    await expect(
      validarSesion.ejecutar({ usuarioId: usuario.id, sesionId: 'sesion-1' }),
    ).rejects.toThrow(NoAutenticadoError);
  });

  it('rechaza sesiones expiradas', async () => {
    const { usuario } = await prepararSesion({
      expiraEn: new Date(Date.now() - 1),
    });

    await expect(
      validarSesion.ejecutar({ usuarioId: usuario.id, sesionId: 'sesion-1' }),
    ).rejects.toThrow(NoAutenticadoError);
  });

  it('rechaza una sesión que pertenece a otro usuario', async () => {
    await prepararSesion();

    await expect(
      validarSesion.ejecutar({ usuarioId: 'otro', sesionId: 'sesion-1' }),
    ).rejects.toThrow(NoAutenticadoError);
  });

  it('rechaza usuarios que dejaron de estar activos', async () => {
    const { usuario } = await prepararSesion();
    usuario.cambiarEstado('inactivo');

    await expect(
      validarSesion.ejecutar({ usuarioId: usuario.id, sesionId: 'sesion-1' }),
    ).rejects.toThrow(NoAutenticadoError);
  });
});
