import { Injectable } from '@nestjs/common';
import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type { PuntoGeografico } from '../../../../common/utils/geografia.js';
import { DireccionGeocodificada } from '../../domain/entities/direccion_geocodificada.entity.js';
import { GeocodificacionInversa } from '../../domain/entities/geocodificacion_inversa.entity.js';
import { GeocodificacionesInversasRepositorio } from '../../domain/repositories/geocodificaciones_inversas.repository.js';
import { clasificarPrecision } from '../../domain/services/precision_ubicacion.js';
import { ConfiguracionGeocodificacion } from '../configuracion_geocodificacion.js';
import { ConsultasEnCurso } from '../../../../common/utils/consultas_en_curso.js';
import { ConsultorProveedores } from '../services/consultor_proveedores.service.js';

export interface ResultadoGeocodificacionInversa {
  geocodificacion: GeocodificacionInversa;
  /** `almacenada`: no se consumió ninguna API. */
  origen: 'almacenada' | 'proveedor';
}

/**
 * Coordenadas → dirección (clic en el mapa). Igual que la geocodificación
 * directa: primero lo guardado, luego los proveedores en orden, y siempre se
 * guarda lo obtenido, incluso "no encontrada", para no volver a pagar por ello.
 */
@Injectable()
export class GeocodificarCoordenadas {
  private readonly enCurso =
    new ConsultasEnCurso<ResultadoGeocodificacionInversa>();

  constructor(
    private readonly geocodificacionesRepositorio: GeocodificacionesInversasRepositorio,
    private readonly consultor: ConsultorProveedores,
    private readonly configuracion: ConfiguracionGeocodificacion,
  ) {}

  ejecutar(punto: PuntoGeografico): Promise<ResultadoGeocodificacionInversa> {
    if (
      !DireccionGeocodificada.sonCoordenadasValidas(
        punto.latitud,
        punto.longitud,
      )
    ) {
      throw new ReglaNegocioError('Las coordenadas no son válidas');
    }
    const clave = GeocodificacionInversa.clavePunto(punto);
    return this.enCurso.ejecutar(clave, () => this.resolver(clave, punto));
  }

  private async resolver(
    clave: string,
    punto: PuntoGeografico,
  ): Promise<ResultadoGeocodificacionInversa> {
    const ahora = new Date();
    const guardada =
      await this.geocodificacionesRepositorio.buscarPorClave(clave);
    if (guardada?.esReutilizable(ahora)) {
      return { geocodificacion: guardada, origen: 'almacenada' };
    }

    const { proveedor, valor } = await this.consultor.consultar(
      async (proveedorActual) => {
        const { lugar } = await proveedorActual.geocodificarInverso(punto);
        if (!lugar) return null;
        const precision = clasificarPrecision(
          lugar,
          this.configuracion.distanciaMaximaInversaMetros,
        );
        return precision ? { lugar, precision } : null;
      },
    );

    const datos = {
      clavePunto: clave,
      puntoSolicitado: punto,
      proveedor,
      fecha: ahora,
    };
    const nueva = valor
      ? GeocodificacionInversa.encontrada({ ...datos, ...valor })
      : GeocodificacionInversa.noEncontrada(datos);

    return {
      geocodificacion: await this.geocodificacionesRepositorio.guardar(nueva),
      origen: 'proveedor',
    };
  }
}
