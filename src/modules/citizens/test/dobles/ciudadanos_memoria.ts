import { ConflictoNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type { Ciudadano } from '../../domain/entities/ciudadano.entity.js';
import type {
  CambioVerificacion,
  DocumentoIdentidad,
} from '../../domain/entities/verificacion_identidad.entity.js';
import {
  CiudadanosRepositorio,
  type FiltrosVerificaciones,
  type RegistroHistorialVerificacion,
} from '../../domain/repositories/ciudadanos.repository.js';
import { AlmacenamientoDocumentos } from '../../domain/services/almacenamiento_documentos.js';

export class CiudadanosMemoria extends CiudadanosRepositorio {
  readonly ciudadanos = new Map<string, Ciudadano>();
  readonly documentos: DocumentoIdentidad[] = [];
  readonly historial: (CambioVerificacion & { usuarioId: string })[] = [];
  /** Correos o documentos de personal u otros usuarios que ya existen. */
  readonly correosOcupados = new Set<string>();
  readonly documentosOcupados = new Set<string>();
  /** Simula una falla de la base de datos en el próximo registro. */
  fallarAlRegistrar = false;

  existeCorreo(correo: string, excluirUsuarioId?: string): Promise<boolean> {
    return Promise.resolve(
      this.correosOcupados.has(correo) ||
        [...this.ciudadanos.values()].some(
          (c) => c.correo === correo && c.id !== excluirUsuarioId,
        ),
    );
  }

  existeDocumento(numero: string, excluirUsuarioId?: string): Promise<boolean> {
    return Promise.resolve(
      this.documentosOcupados.has(numero) ||
        [...this.ciudadanos.values()].some(
          (c) => c.numeroDocumento === numero && c.id !== excluirUsuarioId,
        ),
    );
  }

  existeCiudadanoConDocumento(numero: string): Promise<boolean> {
    return Promise.resolve(
      [...this.ciudadanos.values()].some((c) => c.numeroDocumento === numero),
    );
  }

  registrar(
    ciudadano: Ciudadano,
    _contrasenaHash: string,
    cambio: CambioVerificacion,
  ): Promise<Ciudadano> {
    if (this.fallarAlRegistrar) {
      return Promise.reject(new Error('Base de datos caída'));
    }
    this.ciudadanos.set(ciudadano.id, ciudadano);
    this.documentos.push(...ciudadano.verificacion.documentos);
    this.historial.push({ ...cambio, usuarioId: ciudadano.id });
    return Promise.resolve(ciudadano);
  }

  buscarPorUsuarioId(usuarioId: string): Promise<Ciudadano | null> {
    return Promise.resolve(this.ciudadanos.get(usuarioId) ?? null);
  }

  actualizarContacto(ciudadano: Ciudadano): Promise<Ciudadano> {
    return Promise.resolve(ciudadano);
  }

  registrarReenvio(
    ciudadano: Ciudadano,
    {
      nuevos,
      cambio,
    }: { nuevos: DocumentoIdentidad[]; cambio: CambioVerificacion },
  ): Promise<Ciudadano> {
    this.documentos.push(...nuevos);
    this.historial.push({ ...cambio, usuarioId: ciudadano.id });
    return Promise.resolve(ciudadano);
  }

  registrarDecision(
    ciudadano: Ciudadano,
    cambio: CambioVerificacion,
  ): Promise<Ciudadano> {
    const ultimo = this.historial
      .filter((h) => h.usuarioId === ciudadano.id)
      .at(-1);
    if (ultimo && ultimo.estadoNuevo !== cambio.estadoAnterior) {
      return Promise.reject(new ConflictoNegocioError('Cambió mientras tanto'));
    }
    this.historial.push({ ...cambio, usuarioId: ciudadano.id });
    return Promise.resolve(ciudadano);
  }

  listar(
    { estado }: FiltrosVerificaciones,
    { pagina, limite }: Paginacion,
  ): Promise<ResultadoPaginado<Ciudadano>> {
    const datos = [...this.ciudadanos.values()].filter(
      (c) => !estado || c.verificacion.estado === estado,
    );
    return Promise.resolve({ datos, total: datos.length, pagina, limite });
  }

  buscarDocumento(
    usuarioId: string,
    documentoId: string,
  ): Promise<DocumentoIdentidad | null> {
    const ciudadano = this.ciudadanos.get(usuarioId);
    const propio = ciudadano?.verificacion.documentos.some(
      (d) => d.id === documentoId,
    );
    return Promise.resolve(
      propio
        ? (this.documentos.find((d) => d.id === documentoId) ?? null)
        : null,
    );
  }

  listarHistorial(usuarioId: string): Promise<RegistroHistorialVerificacion[]> {
    return Promise.resolve(
      this.historial
        .filter((h) => h.usuarioId === usuarioId)
        .map((h, indice) => ({
          ...h,
          id: String(indice),
          responsableNombre: null,
        })),
    );
  }
}

export class AlmacenamientoMemoria extends AlmacenamientoDocumentos {
  readonly archivos = new Map<string, Uint8Array>();

  guardar(clave: string, contenido: Uint8Array): Promise<void> {
    this.archivos.set(clave, contenido);
    return Promise.resolve();
  }

  leer(clave: string): Promise<Uint8Array | null> {
    return Promise.resolve(this.archivos.get(clave) ?? null);
  }

  eliminar(clave: string): Promise<void> {
    this.archivos.delete(clave);
    return Promise.resolve();
  }
}

/** Una foto JPG válida (firma real) del tamaño pedido. */
export function fotoJpg(nombre = 'cedula.jpg', tamano = 20 * 1024) {
  const contenido = new Uint8Array(tamano);
  contenido.set([0xff, 0xd8, 0xff, 0xe0]);
  return { nombreOriginal: nombre, tipoMimeDeclarado: 'image/jpeg', contenido };
}

export const DATOS_REGISTRO = {
  nombres: ' Laura ',
  apellidos: 'Gómez Rojas',
  tipoDocumento: 'CC' as const,
  numeroDocumento: '1.090.123.456',
  fechaNacimiento: '1990-05-17',
  telefono: '+57 300 123 4567',
  correo: 'Laura.Gomez@Correo.co',
  contrasena: 'clave-segura-123',
  direccionIp: '10.0.0.1',
};
