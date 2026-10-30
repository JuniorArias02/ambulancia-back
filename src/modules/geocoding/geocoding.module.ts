import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { VariablesEntorno } from '../../config/variables_entorno.js';
import { ConfiguracionGeocodificacion } from './application/configuracion_geocodificacion.js';
import { ConsultorProveedores } from './application/services/consultor_proveedores.service.js';
import { GeocodificarCoordenadas } from './application/use-cases/geocodificar_coordenadas.use-case.js';
import { GeocodificarDireccion } from './application/use-cases/geocodificar_direccion.use-case.js';
import { DireccionesGeocodificadasRepositorio } from './domain/repositories/direcciones_geocodificadas.repository.js';
import { GeocodificacionesInversasRepositorio } from './domain/repositories/geocodificaciones_inversas.repository.js';
import { ProveedoresGeocodificacion } from './domain/services/proveedor_geocodificacion.js';
import { PrismaDireccionesGeocodificadasRepositorio } from './infrastructure/repositories/prisma_direcciones_geocodificadas.repository.js';
import { PrismaGeocodificacionesInversasRepositorio } from './infrastructure/repositories/prisma_geocodificaciones_inversas.repository.js';
import { GeoapifyProveedor } from './infrastructure/services/geoapify_proveedor.service.js';
import { RegistroProveedoresGeocodificacion } from './infrastructure/services/registro_proveedores_geocodificacion.service.js';
import { GeocodificacionController } from './presentation/controllers/geocodificacion.controller.js';

const VALORES_POR_DEFECTO = {
  proveedores: 'geoapify',
  pais: 'co',
  confianzaMinima: 0.6,
  tiempoEsperaMs: 8000,
  distanciaMaximaInversaMetros: 100,
} as const;

type Configuracion = ConfigService<VariablesEntorno, true>;

function pais(configuracion: Configuracion): string | null {
  return (
    configuracion.get('GEOCODIFICACION_PAIS', { infer: true }) ??
    VALORES_POR_DEFECTO.pais
  );
}

@Module({
  controllers: [GeocodificacionController],
  providers: [
    {
      provide: DireccionesGeocodificadasRepositorio,
      useClass: PrismaDireccionesGeocodificadasRepositorio,
    },
    {
      provide: GeocodificacionesInversasRepositorio,
      useClass: PrismaGeocodificacionesInversasRepositorio,
    },
    {
      provide: ConfiguracionGeocodificacion,
      inject: [ConfigService],
      useFactory: (
        configuracion: Configuracion,
      ): ConfiguracionGeocodificacion => ({
        pais: pais(configuracion),
        ciudadPredeterminada:
          configuracion
            .get('GEOCODIFICACION_CIUDAD_PREDETERMINADA', { infer: true })
            ?.trim() || null,
        distanciaMaximaInversaMetros:
          configuracion.get('GEOCODIFICACION_INVERSA_DISTANCIA_MAXIMA_M', {
            infer: true,
          }) ?? VALORES_POR_DEFECTO.distanciaMaximaInversaMetros,
      }),
    },
    {
      provide: GeoapifyProveedor,
      inject: [ConfigService],
      useFactory: (configuracion: Configuracion) =>
        new GeoapifyProveedor({
          apiKey:
            configuracion.get('GEOAPIFY_API_KEY', { infer: true }) ?? null,
          pais: pais(configuracion),
          confianzaMinima:
            configuracion.get('GEOCODIFICACION_CONFIANZA_MINIMA', {
              infer: true,
            }) ?? VALORES_POR_DEFECTO.confianzaMinima,
          tiempoEsperaMs:
            configuracion.get('GEOCODIFICACION_TIEMPO_ESPERA_MS', {
              infer: true,
            }) ?? VALORES_POR_DEFECTO.tiempoEsperaMs,
        }),
    },
    {
      // Para sumar un proveedor: agregarlo a `inject` y a la lista `disponibles`.
      provide: ProveedoresGeocodificacion,
      inject: [ConfigService, GeoapifyProveedor],
      useFactory: (configuracion: Configuracion, geoapify: GeoapifyProveedor) =>
        new RegistroProveedoresGeocodificacion(
          [geoapify],
          (
            configuracion.get('GEOCODIFICACION_PROVEEDORES', { infer: true }) ??
            VALORES_POR_DEFECTO.proveedores
          ).split(','),
        ),
    },
    ConsultorProveedores,
    GeocodificarDireccion,
    GeocodificarCoordenadas,
  ],
  // Para que emergencias o instituciones puedan geocodificar más adelante.
  exports: [GeocodificarDireccion, GeocodificarCoordenadas],
})
export class GeocodingModule {}
