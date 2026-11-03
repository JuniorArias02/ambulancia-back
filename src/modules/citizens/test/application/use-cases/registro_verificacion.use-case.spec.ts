import {
  AuditoriaMemoria,
  HashFalso,
} from '../../../../../../test/dobles/repositorios_memoria.js';
import {
  AccesoDenegadoError,
  ConflictoNegocioError,
  RecursoNoEncontradoError,
  ReglaNegocioError,
} from '../../../../../common/exceptions/errores_dominio.js';
import { DocumentosCargados } from '../../../application/services/documentos_cargados.service.js';
import { ActualizarContactoCiudadano } from '../../../application/use-cases/actualizar_contacto_ciudadano.use-case.js';
import { DecidirVerificacion } from '../../../application/use-cases/decidir_verificacion.use-case.js';
import { ObtenerCiudadano } from '../../../application/use-cases/obtener_ciudadano.use-case.js';
import { ObtenerDocumentoIdentidad } from '../../../application/use-cases/obtener_documento_identidad.use-case.js';
import { ObtenerVerificacion } from '../../../application/use-cases/obtener_verificacion.use-case.js';
import { ReenviarVerificacion } from '../../../application/use-cases/reenviar_verificacion.use-case.js';
import { RegistrarCiudadano } from '../../../application/use-cases/registrar_ciudadano.use-case.js';
import {
  AlmacenamientoMemoria,
  CiudadanosMemoria,
  DATOS_REGISTRO,
  fotoJpg,
} from '../../dobles/ciudadanos_memoria.js';

const administrador = { usuarioId: 'admin-1', direccionIp: '10.0.0.9' };

describe('Registro y verificación de ciudadanos', () => {
  let ciudadanos: CiudadanosMemoria;
  let almacenamiento: AlmacenamientoMemoria;
  let auditoria: AuditoriaMemoria;
  let registrar: RegistrarCiudadano;
  let decidir: DecidirVerificacion;
  let reenviar: ReenviarVerificacion;
  let obtenerDocumento: ObtenerDocumentoIdentidad;
  let actualizarContacto: ActualizarContactoCiudadano;

  beforeEach(() => {
    ciudadanos = new CiudadanosMemoria();
    almacenamiento = new AlmacenamientoMemoria();
    auditoria = new AuditoriaMemoria();
    const documentos = new DocumentosCargados(almacenamiento);
    const obtener = new ObtenerCiudadano(ciudadanos);
    const obtenerVerificacion = new ObtenerVerificacion(
      obtener,
      ciudadanos,
      auditoria,
    );
    registrar = new RegistrarCiudadano(
      ciudadanos,
      new HashFalso(),
      documentos,
      auditoria,
    );
    decidir = new DecidirVerificacion(
      obtener,
      ciudadanos,
      obtenerVerificacion,
      auditoria,
    );
    reenviar = new ReenviarVerificacion(
      obtener,
      ciudadanos,
      documentos,
      auditoria,
    );
    obtenerDocumento = new ObtenerDocumentoIdentidad(
      ciudadanos,
      almacenamiento,
      auditoria,
    );
    actualizarContacto = new ActualizarContactoCiudadano(
      obtener,
      ciudadanos,
      auditoria,
    );
  });

  const registrarValido = (cambios: Partial<typeof DATOS_REGISTRO> = {}) =>
    registrar.ejecutar({
      ...DATOS_REGISTRO,
      ...cambios,
      documentoFrontal: fotoJpg('frente.jpg'),
      documentoPosterior: fotoJpg('reverso.jpeg'),
    });

  describe('registro', () => {
    it('crea la cuenta pendiente, guarda las fotos en privado y audita sin datos personales', async () => {
      const ciudadano = await registrarValido();

      expect(ciudadano.verificacion.estado).toBe('pendiente');
      expect(ciudadano.numeroDocumento).toBe('1090123456');
      expect(ciudadano.correo).toBe('laura.gomez@correo.co');
      expect(almacenamiento.archivos.size).toBe(2);
      expect(ciudadano.verificacion.documentos).toHaveLength(2);
      const evento = auditoria.eventos.at(-1);
      expect(evento?.accion).toBe('registrar_ciudadano');
      expect(JSON.stringify(evento)).not.toContain('1090123456');
      expect(JSON.stringify(evento)).not.toContain('laura');
    });

    it('rechaza un correo ya registrado sin guardar ninguna foto', async () => {
      ciudadanos.correosOcupados.add('laura.gomez@correo.co');

      await expect(registrarValido()).rejects.toThrow(ConflictoNegocioError);
      expect(almacenamiento.archivos.size).toBe(0);
    });

    it('rechaza un documento ya registrado, aunque venga con otro formato', async () => {
      await registrarValido();

      await expect(
        registrarValido({
          correo: 'otra@correo.co',
          numeroDocumento: '1090 123 456',
        }),
      ).rejects.toThrow(ConflictoNegocioError);
      expect(almacenamiento.archivos.size).toBe(2);
    });

    it('el mensaje de duplicado no revela si fue el correo o el documento', async () => {
      ciudadanos.documentosOcupados.add('1090123456');
      await expect(registrarValido()).rejects.toThrow(
        'Ya existe una cuenta con ese correo o ese número de documento',
      );
    });

    it('con una foto inválida no guarda nada', async () => {
      const falsa = fotoJpg('reverso.jpg');
      falsa.contenido.set([0x25, 0x50, 0x44, 0x46]);

      await expect(
        registrar.ejecutar({
          ...DATOS_REGISTRO,
          documentoFrontal: fotoJpg(),
          documentoPosterior: falsa,
        }),
      ).rejects.toThrow(ReglaNegocioError);
      expect(almacenamiento.archivos.size).toBe(0);
      expect(ciudadanos.ciudadanos.size).toBe(0);
    });

    it('si falla la base de datos, borra las fotos ya guardadas', async () => {
      ciudadanos.fallarAlRegistrar = true;

      await expect(registrarValido()).rejects.toThrow('Base de datos caída');
      expect(almacenamiento.archivos.size).toBe(0);
    });

    it('no registra menores de edad', async () => {
      await expect(
        registrarValido({ fechaNacimiento: '2015-01-01' }),
      ).rejects.toThrow(ReglaNegocioError);
      expect(almacenamiento.archivos.size).toBe(0);
    });
  });

  describe('revisión del administrador', () => {
    it('aprueba y queda el historial con quién, cuándo y el estado anterior', async () => {
      const ciudadano = await registrarValido();

      await decidir.ejecutar(
        { usuarioId: ciudadano.id, decision: 'en_revision' },
        administrador,
      );
      const detalle = await decidir.ejecutar(
        { usuarioId: ciudadano.id, decision: 'verificado' },
        administrador,
      );

      expect(detalle.ciudadano.verificacion.estado).toBe('verificado');
      expect(detalle.historial.map((h) => h.estadoNuevo)).toEqual([
        'pendiente',
        'en_revision',
        'verificado',
      ]);
      expect(detalle.historial.at(-1)?.responsableId).toBe('admin-1');
      expect(auditoria.eventos.map((e) => e.accion)).toContain('decidir');
    });

    it('el ciudadano no puede aprobarse a sí mismo', async () => {
      const ciudadano = await registrarValido();

      await expect(
        decidir.ejecutar(
          { usuarioId: ciudadano.id, decision: 'verificado' },
          { usuarioId: ciudadano.id, direccionIp: null },
        ),
      ).rejects.toThrow(AccesoDenegadoError);
    });

    it('dos administradores a la vez: el segundo recibe 409', async () => {
      const ciudadano = await registrarValido();
      // Simula que otro administrador decidió después de la lectura.
      ciudadanos.historial.push({
        usuarioId: ciudadano.id,
        estadoAnterior: 'pendiente',
        estadoNuevo: 'en_revision',
        motivo: null,
        observaciones: null,
        responsableId: 'admin-2',
        ocurridoEn: new Date(),
      });

      await expect(
        decidir.ejecutar(
          { usuarioId: ciudadano.id, decision: 'verificado' },
          administrador,
        ),
      ).rejects.toThrow(ConflictoNegocioError);
    });

    it('una cuenta que no es de ciudadano no existe para este flujo', async () => {
      await expect(
        decidir.ejecutar(
          { usuarioId: 'conductor-1', decision: 'verificado' },
          administrador,
        ),
      ).rejects.toThrow(RecursoNoEncontradoError);
    });
  });

  describe('corrección', () => {
    it('pide corrección, el ciudadano reenvía la foto y vuelve a pendiente', async () => {
      const ciudadano = await registrarValido();
      await decidir.ejecutar(
        {
          usuarioId: ciudadano.id,
          decision: 'requiere_correccion',
          motivo: 'La foto posterior está borrosa',
        },
        administrador,
      );
      expect(ciudadano.verificacion.motivo).toBe(
        'La foto posterior está borrosa',
      );

      const reenviado = await reenviar.ejecutar(
        { identidad: {}, archivos: { posterior: fotoJpg('nueva.jpg') } },
        { usuarioId: ciudadano.id, direccionIp: null },
      );

      expect(reenviado.verificacion.estado).toBe('pendiente');
      expect(almacenamiento.archivos.size).toBe(3);
    });

    it('sin corrección pedida no se puede cambiar el documento', async () => {
      const ciudadano = await registrarValido();

      await expect(
        reenviar.ejecutar(
          { identidad: { numeroDocumento: '55555555' }, archivos: {} },
          { usuarioId: ciudadano.id, direccionIp: null },
        ),
      ).rejects.toThrow(ReglaNegocioError);
      expect(ciudadano.numeroDocumento).toBe('1090123456');
    });
  });

  describe('documentos y perfil', () => {
    it('el administrador descarga la foto y queda auditado', async () => {
      const ciudadano = await registrarValido();
      const [frontal] = ciudadano.verificacion.documentos;

      const archivo = await obtenerDocumento.ejecutar(
        ciudadano.id,
        frontal?.id ?? '',
        administrador,
      );

      expect(archivo.contenido.byteLength).toBe(20 * 1024);
      expect(auditoria.eventos.at(-1)).toEqual(
        expect.objectContaining({
          entidad: 'documentos_identidad',
          accion: 'consultar',
        }),
      );
    });

    it('el id de una foto no sirve con otro ciudadano', async () => {
      const laura = await registrarValido();
      const otro = await registrarValido({
        correo: 'otro@correo.co',
        numeroDocumento: '22222222',
      });
      const fotoDeLaura = laura.verificacion.documentos[0]?.id ?? '';

      await expect(
        obtenerDocumento.ejecutar(otro.id, fotoDeLaura, administrador),
      ).rejects.toThrow(RecursoNoEncontradoError);
    });

    it('el contacto se actualiza; un correo ajeno da 409', async () => {
      const ciudadano = await registrarValido();
      ciudadanos.correosOcupados.add('ocupado@correo.co');
      const contexto = { usuarioId: ciudadano.id, direccionIp: null };

      await actualizarContacto.ejecutar({ telefono: '3109998877' }, contexto);
      expect(ciudadano.telefono).toBe('3109998877');
      await expect(
        actualizarContacto.ejecutar({ correo: 'Ocupado@correo.co' }, contexto),
      ).rejects.toThrow(ConflictoNegocioError);
    });
  });
});
