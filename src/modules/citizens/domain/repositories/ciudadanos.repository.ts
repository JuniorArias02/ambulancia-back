import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type { Ciudadano } from '../entities/ciudadano.entity.js';
import type {
  CambioVerificacion,
  DocumentoIdentidad,
  EstadoVerificacion,
} from '../entities/verificacion_identidad.entity.js';

export interface FiltrosVerificaciones {
  estado?: EstadoVerificacion;
  /** Nombres, apellidos, documento o correo. */
  busqueda?: string;
}

export interface RegistroHistorialVerificacion extends CambioVerificacion {
  id: string;
  responsableNombre: string | null;
}

export abstract class CiudadanosRepositorio {
  abstract existeCorreo(
    correo: string,
    excluirUsuarioId?: string,
  ): Promise<boolean>;
  abstract existeDocumento(
    numeroDocumento: string,
    excluirUsuarioId?: string,
  ): Promise<boolean>;
  /** Solo cuentas de ciudadanos: nunca revela si el documento es del personal. */
  abstract existeCiudadanoConDocumento(
    numeroDocumento: string,
  ): Promise<boolean>;
  /**
   * Usuario, verificación, documentos e historial en una sola transacción.
   * Falla con 409 si el correo o el documento ya existen.
   */
  abstract registrar(
    ciudadano: Ciudadano,
    contrasenaHash: string,
    cambio: CambioVerificacion,
  ): Promise<Ciudadano>;
  /** Solo usuarios con rol ciudadano. */
  abstract buscarPorUsuarioId(usuarioId: string): Promise<Ciudadano | null>;
  abstract actualizarContacto(ciudadano: Ciudadano): Promise<Ciudadano>;
  /**
   * Datos de identidad, fotos nuevas, fotos reemplazadas y estado en una
   * transacción. Falla con 409 si la verificación ya no estaba en
   * `requiere_correccion`.
   */
  abstract registrarReenvio(
    ciudadano: Ciudadano,
    cambios: {
      nuevos: DocumentoIdentidad[];
      reemplazados: DocumentoIdentidad[];
      cambio: CambioVerificacion;
    },
  ): Promise<Ciudadano>;
  /** Falla con 409 si otro administrador decidió antes (estado distinto de `estadoAnterior`). */
  abstract registrarDecision(
    ciudadano: Ciudadano,
    cambio: CambioVerificacion,
  ): Promise<Ciudadano>;
  abstract listar(
    filtros: FiltrosVerificaciones,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<Ciudadano>>;
  /** Incluye los reemplazados: el historial documental se conserva. */
  abstract buscarDocumento(
    usuarioId: string,
    documentoId: string,
  ): Promise<DocumentoIdentidad | null>;
  abstract listarHistorial(
    usuarioId: string,
  ): Promise<RegistroHistorialVerificacion[]>;
}
