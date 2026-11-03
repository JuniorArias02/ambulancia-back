import { Injectable, Logger } from '@nestjs/common';
import {
  AccesoDenegadoError,
  ConflictoNegocioError,
  ReglaNegocioError,
  ServicioNoDisponibleError,
} from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import type { PuntoGeografico } from '../../../../common/utils/geografia.js';
import { RegistrarEmergencia } from '../../../emergencies/application/use-cases/registrar_emergencia.use-case.js';
import type {
  Emergencia,
  OrigenUbicacion,
  TipoIncidente,
} from '../../../emergencies/domain/entities/emergencia.entity.js';
import { EmergenciasRepositorio } from '../../../emergencies/domain/repositories/emergencias.repository.js';
import { GeocodificarCoordenadas } from '../../../geocoding/application/use-cases/geocodificar_coordenadas.use-case.js';
import { ObtenerCiudadano } from './obtener_ciudadano.use-case.js';

export interface ReportarEmergenciaEntrada {
  /** Generado por la app: un reintento con el mismo id devuelve el mismo reporte. */
  id: string;
  tipoIncidente: TipoIncidente;
  descripcion: string;
  numeroVictimas?: number;
  latitud: number;
  longitud: number;
  origenUbicacion: OrigenUbicacion;
  referenciaLugar?: string;
}

export interface ReporteRegistrado {
  emergencia: Emergencia;
  /** `false` si era un reintento de un reporte ya recibido. */
  creado: boolean;
}

export const MENSAJE_SIN_VERIFICAR =
  'Su identidad todavía no ha sido verificada; no puede reportar emergencias desde la app. Si la emergencia es inmediata, llame a la línea 123.';

/**
 * El ciudadano verificado reporta; la central decide. Queda `recibida`, sin
 * prioridad y sin ambulancia: el operador la revisa, clasifica y despacha con
 * el flujo de siempre.
 */
@Injectable()
export class ReportarEmergenciaCiudadana {
  private readonly logger = new Logger(ReportarEmergenciaCiudadana.name);

  constructor(
    private readonly obtenerCiudadano: ObtenerCiudadano,
    private readonly emergenciasRepositorio: EmergenciasRepositorio,
    private readonly registrarEmergencia: RegistrarEmergencia,
    private readonly geocodificarCoordenadas: GeocodificarCoordenadas,
  ) {}

  async ejecutar(
    datos: ReportarEmergenciaEntrada,
    contexto: ContextoSolicitud,
  ): Promise<ReporteRegistrado> {
    const ciudadano = await this.obtenerCiudadano.ejecutar(contexto.usuarioId);
    // Se revisa en cada solicitud: ocultar el botón en la app no basta.
    if (!ciudadano.verificacion.permiteReportar()) {
      throw new AccesoDenegadoError(MENSAJE_SIN_VERIFICAR);
    }

    const previo = await this.reintento(datos.id, ciudadano.id);
    if (previo) return { emergencia: previo, creado: false };

    const direccion = await this.direccionDe({
      latitud: datos.latitud,
      longitud: datos.longitud,
    });
    try {
      const emergencia = await this.registrarEmergencia.ejecutar(
        {
          id: datos.id,
          fuente: 'app',
          // El informante sale de la cuenta, nunca de lo que envía la app.
          informanteNombre: ciudadano.nombreCompleto,
          informanteTelefono: ciudadano.telefono,
          informanteUsuarioId: ciudadano.id,
          descripcion: datos.descripcion,
          tipoIncidente: datos.tipoIncidente,
          prioridad: null,
          direccion,
          referenciaLugar: datos.referenciaLugar,
          latitud: datos.latitud,
          longitud: datos.longitud,
          origenUbicacion: datos.origenUbicacion,
          numeroVictimas: datos.numeroVictimas,
        },
        contexto,
        { recibidaPorCentral: false },
      );
      return { emergencia, creado: true };
    } catch (error) {
      // Dos envíos simultáneos con el mismo id: el segundo choca y devuelve el primero.
      if (error instanceof ConflictoNegocioError) {
        const ganador = await this.reintento(datos.id, ciudadano.id);
        if (ganador) return { emergencia: ganador, creado: false };
      }
      throw error;
    }
  }

  private async reintento(
    id: string,
    ciudadanoId: string,
  ): Promise<Emergencia | null> {
    const existente = await this.emergenciasRepositorio.buscarPorId(id);
    if (!existente) return null;
    if (existente.informanteUsuarioId !== ciudadanoId) {
      throw new ConflictoNegocioError(
        'Ese identificador de reporte ya está en uso; genere uno nuevo',
      );
    }
    return existente;
  }

  /**
   * La dirección se obtiene en el servidor con la geocodificación existente.
   * Si no se encuentra o el proveedor falla, queda vacía: nunca se inventa, y
   * el reporte no se pierde por eso (la central tiene las coordenadas).
   */
  private async direccionDe(punto: PuntoGeografico): Promise<string | null> {
    try {
      const { geocodificacion } =
        await this.geocodificarCoordenadas.ejecutar(punto);
      // La columna admite 255 caracteres.
      return geocodificacion.direccion?.slice(0, 255) ?? null;
    } catch (error) {
      if (
        error instanceof ReglaNegocioError ||
        error instanceof ServicioNoDisponibleError
      ) {
        this.logger.warn(
          `Reporte ciudadano sin dirección: ${error.constructor.name}`,
        );
        return null;
      }
      throw error;
    }
  }
}
