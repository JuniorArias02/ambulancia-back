import { ReglaNegocioError } from '../../../../../common/exceptions/errores_dominio.js';
import { ConsultarAccesoCiudadano } from '../../../application/use-cases/consultar_acceso_ciudadano.use-case.js';
import { Ciudadano } from '../../../domain/entities/ciudadano.entity.js';
import { VerificacionIdentidad } from '../../../domain/entities/verificacion_identidad.entity.js';
import { CiudadanosMemoria } from '../../dobles/ciudadanos_memoria.js';

describe('ConsultarAccesoCiudadano', () => {
  let ciudadanos: CiudadanosMemoria;
  let consultar: ConsultarAccesoCiudadano;

  beforeEach(() => {
    ciudadanos = new CiudadanosMemoria();
    consultar = new ConsultarAccesoCiudadano(ciudadanos);
    const ciudadano = Ciudadano.reconstruir({
      id: 'c1',
      nombres: 'Laura',
      apellidos: 'Gómez',
      tipoDocumento: 'CC',
      numeroDocumento: '1090123456',
      fechaNacimiento: '1990-05-17',
      correo: 'laura@correo.co',
      telefono: '3001234567',
      estadoCuenta: 'activo',
      creadoEn: new Date(),
      verificacion: VerificacionIdentidad.reconstruir({
        id: 'v1',
        usuarioId: 'c1',
        estado: 'pendiente',
        motivo: null,
        enviadaEn: new Date(),
        revisadaPorId: null,
        revisadaEn: null,
        documentos: [],
      }),
    });
    ciudadanos.ciudadanos.set(ciudadano.id, ciudadano);
  });

  it('cédula registrada (con cualquier formato): pedir la contraseña', async () => {
    expect(await consultar.ejecutar('1.090.123-456')).toEqual({
      registrado: true,
      siguientePaso: 'iniciar_sesion',
    });
  });

  it('cédula sin cuenta: ir al registro', async () => {
    expect(await consultar.ejecutar('5555555')).toEqual({
      registrado: false,
      siguientePaso: 'registrarse',
    });
  });

  it('un documento del personal no se revela: cuenta como no registrado', async () => {
    ciudadanos.documentosOcupados.add('88888888');
    expect((await consultar.ejecutar('88888888')).registrado).toBe(false);
  });

  it('rechaza un documento que no puede ser válido', async () => {
    await expect(consultar.ejecutar('1.2')).rejects.toThrow(ReglaNegocioError);
  });
});
