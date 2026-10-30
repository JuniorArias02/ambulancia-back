import { ReglaNegocioError } from '../../../../../common/exceptions/errores_dominio.js';
import { Usuario } from '../../../domain/entities/usuario.entity.js';

describe('Usuario', () => {
  const datosBase = {
    nombres: '  Laura ',
    apellidos: 'Gómez',
    correo: '  Laura@Galenos.CO ',
    telefono: '   ',
    contrasenaHash: 'hash',
    rol: ' despachador ',
  };

  it('normaliza correo, nombres, teléfono y rol al crearse', () => {
    const usuario = Usuario.crear(datosBase);

    expect(usuario.correo).toBe('laura@galenos.co');
    expect(usuario.nombres).toBe('Laura');
    expect(usuario.telefono).toBeNull();
    expect(usuario.rol).toBe('despachador');
    expect(usuario.estado).toBe('activo');
    expect(usuario.estaActivo()).toBe(true);
  });

  it('rechaza roles inexistentes', () => {
    expect(() => Usuario.crear({ ...datosBase, rol: 'operador' })).toThrow(
      ReglaNegocioError,
    );
  });

  it('rechaza cambiar al mismo estado', () => {
    const usuario = Usuario.crear(datosBase);
    expect(() => usuario.cambiarEstado('activo')).toThrow(ReglaNegocioError);

    usuario.cambiarEstado('bloqueado');
    expect(usuario.estaActivo()).toBe(false);
  });

  it('actualiza solo los datos personales enviados', () => {
    const usuario = Usuario.crear({ ...datosBase, telefono: '3001234567' });

    usuario.actualizarDatosPersonales({ apellidos: 'Pérez' });
    expect(usuario.apellidos).toBe('Pérez');
    expect(usuario.telefono).toBe('3001234567');

    usuario.actualizarDatosPersonales({ telefono: null });
    expect(usuario.telefono).toBeNull();
  });
});
