import { createHash } from 'node:crypto';
import {
  AuditoriaMemoria,
  HashFalso,
  UsuariosMemoria,
} from '../../../../../test/dobles/repositorios_memoria.js';
import { Roles } from '../../../../common/constants/roles.js';
import {
  RecursoNoEncontradoError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import { Usuario } from '../../../users/domain/entities/usuario.entity.js';
import {
  FirmaAlteradaError,
  LectorImagenFirma,
} from '../../application/services/lector_imagen_firma.service.js';
import { ConsultarFirmasUsuario } from '../../application/use-cases/consultar_firmas_usuario.use-case.js';
import { DesactivarFirma } from '../../application/use-cases/desactivar_firma.use-case.js';
import { ObtenerImagenFirma } from '../../application/use-cases/obtener_imagen_firma.use-case.js';
import { ObtenerMiFirma } from '../../application/use-cases/obtener_mi_firma.use-case.js';
import { RegistrarMiFirma } from '../../application/use-cases/registrar_mi_firma.use-case.js';
import {
  AlmacenamientoFirmasMemoria,
  crearPngPrueba,
  FirmasUsuariosMemoria,
} from '../dobles/firmas_memoria.js';

const CONTRASENA = 'Secreta2026';
const paramedico = {
  usuarioId: 'paramedico-1',
  direccionIp: null,
  rol: Roles.PARAMEDICO,
};
const admin = {
  usuarioId: 'admin-1',
  direccionIp: null,
  rol: Roles.ADMINISTRADOR,
};

describe('Firmas de los profesionales (casos de uso)', () => {
  let firmas: FirmasUsuariosMemoria;
  let almacenamiento: AlmacenamientoFirmasMemoria;
  let auditoria: AuditoriaMemoria;
  let registrar: RegistrarMiFirma;
  let obtenerMia: ObtenerMiFirma;
  let obtenerImagen: ObtenerImagenFirma;
  let consultar: ConsultarFirmasUsuario;
  let desactivar: DesactivarFirma;

  beforeEach(() => {
    firmas = new FirmasUsuariosMemoria();
    almacenamiento = new AlmacenamientoFirmasMemoria();
    auditoria = new AuditoriaMemoria();
    const usuarios = new UsuariosMemoria();
    usuarios.usuarios.set(
      paramedico.usuarioId,
      Usuario.reconstruir({
        id: paramedico.usuarioId,
        nombres: 'Lucía',
        apellidos: 'Rojas',
        correo: 'lucia@galenos.co',
        telefono: null,
        contrasenaHash: `hash:${CONTRASENA}`,
        estado: 'activo',
        rol: Roles.PARAMEDICO,
        ultimoAcceso: null,
        creadoEn: new Date(),
      }),
    );
    const lector = new LectorImagenFirma(almacenamiento);
    registrar = new RegistrarMiFirma(
      firmas,
      almacenamiento,
      usuarios,
      new HashFalso(),
      auditoria,
    );
    obtenerMia = new ObtenerMiFirma(firmas);
    obtenerImagen = new ObtenerImagenFirma(firmas, lector, auditoria);
    consultar = new ConsultarFirmasUsuario(firmas, usuarios);
    desactivar = new DesactivarFirma(firmas, auditoria);
  });

  const registrarFirma = (imagen = crearPngPrueba()) =>
    registrar.ejecutar({ imagen, contrasena: CONTRASENA }, paramedico);

  it('el profesional registra su firma con su contraseña: queda vigente y con su huella', async () => {
    const png = crearPngPrueba(600, 200);
    const firma = await registrarFirma(png);

    expect(firma).toMatchObject({
      usuarioId: paramedico.usuarioId,
      vigente: true,
      anchoPx: 600,
      altoPx: 200,
    });
    expect(firma.huellaSha256).toBe(
      createHash('sha256').update(png).digest('hex'),
    );
    expect(almacenamiento.archivos.has(firma.claveAlmacenamiento)).toBe(true);
    expect((await obtenerMia.ejecutar(paramedico))?.id).toBe(firma.id);
    expect(auditoria.eventos.at(-1)).toMatchObject({
      entidad: 'firmas_usuarios',
      accion: 'registrar',
    });
  });

  it('cambiarla no borra la anterior: queda reemplazada y solo una vigente', async () => {
    const primera = await registrarFirma();
    const segunda = await registrarFirma(crearPngPrueba(700, 250));

    const historial = await consultar.ejecutar(paramedico.usuarioId);
    expect(historial.map((f) => f.estado).sort()).toEqual([
      'reemplazada',
      'vigente',
    ]);
    expect(historial.find((f) => f.id === primera.id)?.estado).toBe(
      'reemplazada',
    );
    expect((await obtenerMia.ejecutar(paramedico))?.id).toBe(segunda.id);
  });

  it('con una contraseña errada no se registra y la auditoría no guarda la contraseña', async () => {
    await expect(
      registrar.ejecutar(
        { imagen: crearPngPrueba(), contrasena: 'Equivocada1' },
        paramedico,
      ),
    ).rejects.toThrow(/no se registró/);

    expect(firmas.firmas.size).toBe(0);
    expect(almacenamiento.archivos.size).toBe(0);
    expect(auditoria.eventos.at(-1)?.accion).toBe('registrar_rechazada');
    expect(JSON.stringify(auditoria.eventos)).not.toContain('Equivocada1');
  });

  it('una imagen inválida no deja ningún archivo guardado', async () => {
    await expect(registrarFirma(new Uint8Array([1, 2, 3]))).rejects.toThrow(
      ReglaNegocioError,
    );
    expect(almacenamiento.archivos.size).toBe(0);
  });

  it('si la base de datos falla, borra el archivo para no dejarlo huérfano', async () => {
    firmas.fallarAlRegistrar = true;
    await expect(registrarFirma()).rejects.toThrow(/no respondió/);
    expect(almacenamiento.archivos.size).toBe(0);
  });

  it('cada quien ve su firma, y el administrador solo la de ese usuario (auditado)', async () => {
    const firma = await registrarFirma();

    const propia = await obtenerImagen.propia(paramedico);
    expect(propia.firma.id).toBe(firma.id);
    const delAdmin = await obtenerImagen.deUsuario(
      paramedico.usuarioId,
      firma.id,
      admin,
    );
    expect(delAdmin.contenido.byteLength).toBe(firma.tamanoBytes);
    expect(auditoria.eventos.at(-1)).toMatchObject({
      accion: 'consultar_imagen',
      usuarioId: admin.usuarioId,
    });
    await expect(
      obtenerImagen.deUsuario('otro-usuario', firma.id, admin),
    ).rejects.toThrow(RecursoNoEncontradoError);
  });

  it('si alguien cambió el archivo, no entrega la imagen', async () => {
    const firma = await registrarFirma();
    almacenamiento.archivos.set(
      firma.claveAlmacenamiento,
      crearPngPrueba(800, 300),
    );

    await expect(obtenerImagen.propia(paramedico)).rejects.toThrow(
      FirmaAlteradaError,
    );
  });

  it('el administrador la desactiva con un motivo; después el profesional no tiene firma vigente', async () => {
    const firma = await registrarFirma();

    const desactivada = await desactivar.ejecutar(
      paramedico.usuarioId,
      firma.id,
      'Firma ilegible',
      admin,
    );

    expect(desactivada.estado).toBe('desactivada');
    expect(await obtenerMia.ejecutar(paramedico)).toBeNull();
    expect(auditoria.eventos.at(-1)).toMatchObject({
      accion: 'desactivar',
      detalle: { motivo: 'Firma ilegible' },
    });
    await expect(
      desactivar.ejecutar(paramedico.usuarioId, firma.id, 'Otra vez', admin),
    ).rejects.toThrow(/ya no está vigente/);
  });
});
