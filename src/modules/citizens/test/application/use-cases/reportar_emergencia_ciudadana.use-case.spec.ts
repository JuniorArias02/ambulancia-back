import { EmergenciasMemoria } from '../../../../../../test/dobles/emergencias_memoria.js';
import { PublicadorEventosMemoria } from '../../../../../../test/dobles/publicador_eventos_memoria.js';
import { AuditoriaMemoria } from '../../../../../../test/dobles/repositorios_memoria.js';
import {
  AccesoDenegadoError,
  ConflictoNegocioError,
  RecursoNoEncontradoError,
  ServicioNoDisponibleError,
} from '../../../../../common/exceptions/errores_dominio.js';
import { RegistrarEmergencia } from '../../../../emergencies/application/use-cases/registrar_emergencia.use-case.js';
import type { GeocodificarCoordenadas } from '../../../../geocoding/application/use-cases/geocodificar_coordenadas.use-case.js';
import { ConsultarMisEmergencias } from '../../../application/use-cases/consultar_mis_emergencias.use-case.js';
import { ObtenerCiudadano } from '../../../application/use-cases/obtener_ciudadano.use-case.js';
import {
  MENSAJE_SIN_VERIFICAR,
  ReportarEmergenciaCiudadana,
} from '../../../application/use-cases/reportar_emergencia_ciudadana.use-case.js';
import { Ciudadano } from '../../../domain/entities/ciudadano.entity.js';
import {
  type EstadoVerificacion,
  VerificacionIdentidad,
} from '../../../domain/entities/verificacion_identidad.entity.js';
import { CiudadanosMemoria } from '../../dobles/ciudadanos_memoria.js';

/** Responde como la geocodificación real, o falla como un proveedor caído. */
class GeocodificacionFalsa {
  falla: Error | null = null;

  ejecutar() {
    if (this.falla) return Promise.reject(this.falla);
    return Promise.resolve({
      geocodificacion: { direccion: 'Av. 0 # 10-20, Cúcuta' },
      origen: 'proveedor',
    });
  }
}

const reporte = {
  tipoIncidente: 'accidente_transito' as const,
  descripcion: 'Choque de moto contra carro en la avenida',
  numeroVictimas: 2,
  latitud: 7.893906,
  longitud: -72.507782,
  origenUbicacion: 'gps' as const,
  referenciaLugar: 'Frente a la panadería',
};

describe('Reportes de emergencia de ciudadanos', () => {
  let ciudadanos: CiudadanosMemoria;
  let emergencias: EmergenciasMemoria;
  let eventos: PublicadorEventosMemoria;
  let geocodificacion: GeocodificacionFalsa;
  let reportar: ReportarEmergenciaCiudadana;
  let misEmergencias: ConsultarMisEmergencias;

  function ciudadanoEn(
    estado: EstadoVerificacion,
    id = crypto.randomUUID(),
  ): Ciudadano {
    const ciudadano = Ciudadano.reconstruir({
      id,
      nombres: 'Laura',
      apellidos: 'Gómez',
      tipoDocumento: 'CC',
      numeroDocumento: id.slice(0, 8).replace(/-/g, '').toUpperCase(),
      fechaNacimiento: '1990-05-17',
      correo: `${id}@correo.co`,
      telefono: '3001234567',
      estadoCuenta: 'activo',
      creadoEn: new Date(),
      verificacion: VerificacionIdentidad.reconstruir({
        id: crypto.randomUUID(),
        usuarioId: id,
        estado,
        motivo: null,
        enviadaEn: new Date(),
        revisadaPorId: null,
        revisadaEn: null,
        documentos: [],
      }),
    });
    ciudadanos.ciudadanos.set(id, ciudadano);
    return ciudadano;
  }

  const contextoDe = (ciudadano: Ciudadano) => ({
    usuarioId: ciudadano.id,
    direccionIp: '10.0.0.1',
  });

  beforeEach(() => {
    ciudadanos = new CiudadanosMemoria();
    emergencias = new EmergenciasMemoria();
    eventos = new PublicadorEventosMemoria();
    geocodificacion = new GeocodificacionFalsa();
    reportar = new ReportarEmergenciaCiudadana(
      new ObtenerCiudadano(ciudadanos),
      emergencias,
      new RegistrarEmergencia(emergencias, new AuditoriaMemoria(), eventos),
      geocodificacion as unknown as GeocodificarCoordenadas,
    );
    misEmergencias = new ConsultarMisEmergencias(emergencias);
  });

  it.each([
    'pendiente',
    'en_revision',
    'rechazado',
    'requiere_correccion',
  ] as const)('un ciudadano %s no puede reportar', async (estado) => {
    const ciudadano = ciudadanoEn(estado);

    await expect(
      reportar.ejecutar(
        { ...reporte, id: crypto.randomUUID() },
        contextoDe(ciudadano),
      ),
    ).rejects.toThrow(new AccesoDenegadoError(MENSAJE_SIN_VERIFICAR));
    expect(emergencias.emergencias.size).toBe(0);
  });

  it('un usuario que no es ciudadano no puede usar este flujo', async () => {
    await expect(
      reportar.ejecutar(
        { ...reporte, id: crypto.randomUUID() },
        { usuarioId: 'conductor-1', direccionIp: null },
      ),
    ).rejects.toThrow(RecursoNoEncontradoError);
  });

  it('el verificado reporta: queda recibida, sin prioridad, sin receptor y con el informante de la cuenta', async () => {
    const ciudadano = ciudadanoEn('verificado');
    const id = crypto.randomUUID();

    const { emergencia, creado } = await reportar.ejecutar(
      { ...reporte, id },
      contextoDe(ciudadano),
    );

    expect(creado).toBe(true);
    expect(emergencia.id).toBe(id);
    expect(emergencia.estado).toBe('recibida');
    expect(emergencia.prioridad).toBeNull();
    expect(emergencia.fuente).toBe('app');
    expect(emergencia.recibidaPorId).toBeNull();
    expect(emergencia.informanteUsuarioId).toBe(ciudadano.id);
    expect(emergencia.informanteNombre).toBe('Laura Gómez');
    expect(emergencia.informanteTelefono).toBe('3001234567');
    expect(emergencia.origenUbicacion).toBe('gps');
    expect(emergencia.direccion).toBe('Av. 0 # 10-20, Cúcuta');
    // La central se entera por el mismo evento que usa el resto del sistema.
    expect(eventos.eventos).toContainEqual({
      tipo: 'emergencia.creada',
      emergenciaId: id,
    });
  });

  it('un reintento con el mismo id devuelve el mismo reporte sin duplicarlo', async () => {
    const ciudadano = ciudadanoEn('verificado');
    const id = crypto.randomUUID();
    await reportar.ejecutar({ ...reporte, id }, contextoDe(ciudadano));

    const repetido = await reportar.ejecutar(
      { ...reporte, id },
      contextoDe(ciudadano),
    );

    expect(repetido.creado).toBe(false);
    expect(emergencias.emergencias.size).toBe(1);
    expect(
      eventos.eventos.filter((e) => e.tipo === 'emergencia.creada'),
    ).toHaveLength(1);
  });

  it('el id de otro ciudadano no se reutiliza (409) ni revela su reporte', async () => {
    const laura = ciudadanoEn('verificado');
    const otro = ciudadanoEn('verificado');
    const id = crypto.randomUUID();
    await reportar.ejecutar({ ...reporte, id }, contextoDe(laura));

    await expect(
      reportar.ejecutar({ ...reporte, id }, contextoDe(otro)),
    ).rejects.toThrow(ConflictoNegocioError);
  });

  it('si la geocodificación falla, el reporte se guarda sin dirección (no se inventa)', async () => {
    const ciudadano = ciudadanoEn('verificado');
    geocodificacion.falla = new ServicioNoDisponibleError('Proveedor caído');

    const { emergencia } = await reportar.ejecutar(
      { ...reporte, id: crypto.randomUUID(), origenUbicacion: 'manual' },
      contextoDe(ciudadano),
    );

    expect(emergencia.direccion).toBeNull();
    expect(emergencia.coordenadas).toEqual({
      latitud: reporte.latitud,
      longitud: reporte.longitud,
    });
    expect(emergencia.origenUbicacion).toBe('manual');
  });

  it('un error inesperado de la geocodificación no se oculta', async () => {
    const ciudadano = ciudadanoEn('verificado');
    geocodificacion.falla = new Error('Fallo de programación');

    await expect(
      reportar.ejecutar(
        { ...reporte, id: crypto.randomUUID() },
        contextoDe(ciudadano),
      ),
    ).rejects.toThrow('Fallo de programación');
  });

  it('cada ciudadano solo ve sus reportes; uno ajeno responde 404', async () => {
    const laura = ciudadanoEn('verificado');
    const otro = ciudadanoEn('verificado');
    const { emergencia: deLaura } = await reportar.ejecutar(
      { ...reporte, id: crypto.randomUUID() },
      contextoDe(laura),
    );
    await reportar.ejecutar(
      { ...reporte, id: crypto.randomUUID() },
      contextoDe(otro),
    );

    const lista = await misEmergencias.listar(
      laura.id,
      {},
      { pagina: 1, limite: 20 },
    );
    expect(lista.datos.map((e) => e.id)).toEqual([deLaura.id]);
    await expect(misEmergencias.obtener(otro.id, deLaura.id)).rejects.toThrow(
      RecursoNoEncontradoError,
    );
  });
});
