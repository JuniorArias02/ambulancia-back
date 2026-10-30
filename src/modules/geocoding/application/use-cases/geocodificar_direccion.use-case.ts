import { Injectable } from '@nestjs/common';
import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import { DireccionGeocodificada } from '../../domain/entities/direccion_geocodificada.entity.js';
import { DireccionesGeocodificadasRepositorio } from '../../domain/repositories/direcciones_geocodificadas.repository.js';
import {
  claveGeocodificacion,
  coincideNomenclatura,
  LONGITUD_MAXIMA_CLAVE,
  normalizarDireccion,
} from '../../domain/services/normalizador_direcciones.js';
import { ConfiguracionGeocodificacion } from '../configuracion_geocodificacion.js';
import { ConsultasEnCurso } from '../../../../common/utils/consultas_en_curso.js';
import { ConsultorProveedores } from '../services/consultor_proveedores.service.js';

export interface GeocodificarDireccionEntrada {
  direccion: string;
  ciudad?: string | null;
}

export interface ResultadoGeocodificacion {
  direccion: DireccionGeocodificada;
  /** `almacenada`: no se consumió ninguna API. */
  origen: 'almacenada' | 'proveedor';
}

/**
 * Dirección → coordenadas. Busca primero en lo ya geocodificado y solo
 * consulta proveedores externos si hace falta. Devuelve también las no
 * encontradas: decidir qué hacer con ellas (por ejemplo, pedir el punto en
 * el mapa) le corresponde a quien llama.
 */
@Injectable()
export class GeocodificarDireccion {
  private readonly enCurso = new ConsultasEnCurso<ResultadoGeocodificacion>();

  constructor(
    private readonly direccionesRepositorio: DireccionesGeocodificadasRepositorio,
    private readonly consultor: ConsultorProveedores,
    private readonly configuracion: ConfiguracionGeocodificacion,
  ) {}

  ejecutar(
    datos: GeocodificarDireccionEntrada,
  ): Promise<ResultadoGeocodificacion> {
    const direccion = datos.direccion.trim();
    const ciudad =
      datos.ciudad?.trim() || this.configuracion.ciudadPredeterminada;
    if (!normalizarDireccion(direccion)) {
      throw new ReglaNegocioError(
        'La dirección no tiene contenido para buscar',
      );
    }
    if (!ciudad) {
      throw new ReglaNegocioError('Indique la ciudad de la dirección');
    }
    const clave = claveGeocodificacion({
      direccion,
      ciudad,
      pais: this.configuracion.pais,
    });
    if (clave.length > LONGITUD_MAXIMA_CLAVE) {
      throw new ReglaNegocioError('La dirección es demasiado larga');
    }

    return this.enCurso.ejecutar(clave, () =>
      this.resolver(clave, direccion, ciudad),
    );
  }

  private async resolver(
    clave: string,
    direccion: string,
    ciudad: string,
  ): Promise<ResultadoGeocodificacion> {
    const ahora = new Date();
    const guardada = await this.direccionesRepositorio.buscarPorClave(clave);
    if (guardada?.esReutilizable(ahora)) {
      return { direccion: guardada, origen: 'almacenada' };
    }

    // De cada proveedor se toma el primer candidato que sea, de verdad, la
    // dirección pedida: el puntaje del proveedor no basta.
    const { proveedor, valor: ubicacion } = await this.consultor.consultar(
      async (proveedorActual) => {
        const { candidatos } = await proveedorActual.geocodificar({
          direccion,
          ciudad,
        });
        return (
          candidatos.find(
            (candidato) =>
              DireccionGeocodificada.sonCoordenadasValidas(
                candidato.latitud,
                candidato.longitud,
              ) &&
              coincideNomenclatura(direccion, candidato.direccionFormateada),
          ) ?? null
        );
      },
    );

    const datos = {
      direccionOriginal: direccion,
      direccionNormalizada: clave,
      ciudad,
      proveedor,
      fecha: ahora,
    };
    const nueva = ubicacion
      ? DireccionGeocodificada.encontrada({ ...datos, ubicacion })
      : DireccionGeocodificada.noEncontrada(datos);

    return {
      direccion: await this.direccionesRepositorio.guardar(nueva),
      origen: 'proveedor',
    };
  }
}
