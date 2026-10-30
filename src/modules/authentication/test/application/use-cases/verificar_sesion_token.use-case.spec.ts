import {
  SesionesMemoria,
  UsuariosMemoria,
  crearUsuarioPrueba,
} from '../../../../../../test/dobles/repositorios_memoria.js';
import { NoAutenticadoError } from '../../../../../common/exceptions/errores_dominio.js';
import { ValidarSesion } from '../../../application/use-cases/validar_sesion.use-case.js';
import { VerificarSesionToken } from '../../../application/use-cases/verificar_sesion_token.use-case.js';
import { Sesion } from '../../../domain/entities/sesion.entity.js';
import {
  type TokenVerificado,
  VerificadorTokens,
} from '../../../domain/services/verificador_tokens.service.js';

class VerificadorTokensFalso extends VerificadorTokens {
  constructor(private readonly tokens: Map<string, TokenVerificado>) {
    super();
  }

  verificar(token: string): Promise<TokenVerificado> {
    const verificado = this.tokens.get(token);
    return verificado
      ? Promise.resolve(verificado)
      : Promise.reject(new NoAutenticadoError('Token inválido'));
  }
}

describe('VerificarSesionToken', () => {
  const expiraEn = new Date(Date.now() + 3_600_000);
  let usuarios: UsuariosMemoria;
  let sesiones: SesionesMemoria;
  let verificar: VerificarSesionToken;
  let tokens: Map<string, TokenVerificado>;

  beforeEach(() => {
    usuarios = new UsuariosMemoria();
    sesiones = new SesionesMemoria();
    tokens = new Map();
    verificar = new VerificarSesionToken(
      new VerificadorTokensFalso(tokens),
      new ValidarSesion(sesiones, usuarios),
    );
  });

  async function sesionDe(rol: string) {
    const usuario = await usuarios.crear(crearUsuarioPrueba({ rol }));
    const sesion = Sesion.crear({
      id: 'sesion-1',
      usuarioId: usuario.id,
      tokenHash: 'huella',
      expiraEn,
    });
    await sesiones.guardar(sesion);
    tokens.set('token-valido', {
      usuarioId: usuario.id,
      sesionId: sesion.id,
      expiraEn,
    });
    return usuario;
  }

  it('devuelve el usuario con su rol vigente y el vencimiento del token', async () => {
    const usuario = await sesionDe('conductor');

    const resultado = await verificar.ejecutar('token-valido');

    expect(resultado.usuario).toEqual(
      expect.objectContaining({ id: usuario.id, rol: 'conductor' }),
    );
    expect(resultado.expiraEn).toEqual(expiraEn);
  });

  it('rechaza un token inválido', async () => {
    await expect(verificar.ejecutar('otro')).rejects.toThrow(
      NoAutenticadoError,
    );
  });
});
