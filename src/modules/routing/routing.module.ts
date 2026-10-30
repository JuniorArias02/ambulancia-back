import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClienteGeoapify } from '../../common/integrations/geoapify/cliente_geoapify.js';
import type { VariablesEntorno } from '../../config/variables_entorno.js';
import { AmbulancesModule } from '../ambulances/ambulances.module.js';
import { AssignmentsModule } from '../assignments/assignments.module.js';
import { EmergenciesModule } from '../emergencies/emergencies.module.js';
import { ConfiguracionRutas } from './application/configuracion_rutas.js';
import { CalcularRutaAsignacion } from './application/use-cases/calcular_ruta_asignacion.use-case.js';
import { ConsultarRutasActivas } from './application/use-cases/consultar_rutas_activas.use-case.js';
import { ObtenerRutaAsignacion } from './application/use-cases/obtener_ruta_asignacion.use-case.js';
import { RutasAsignacionRepositorio } from './domain/repositories/rutas_asignacion.repository.js';
import { ProveedoresRutas } from './domain/services/proveedor_rutas.js';
import { PrismaRutasAsignacionRepositorio } from './infrastructure/repositories/prisma_rutas_asignacion.repository.js';
import { GeoapifyRutasProveedor } from './infrastructure/services/geoapify_rutas_proveedor.service.js';
import { RegistroProveedoresRutas } from './infrastructure/services/registro_proveedores_rutas.service.js';
import { RutasController } from './presentation/controllers/rutas.controller.js';
import { RecalculadorRutas } from './presentation/listeners/recalculador_rutas.listener.js';

const VALORES_POR_DEFECTO = {
  proveedores: 'geoapify',
  distanciaDesvioMetros: 150,
  intervaloRecalculoSegundos: 60,
  tiempoEsperaMs: 8000,
} as const;

type Configuracion = ConfigService<VariablesEntorno, true>;

/**
 * Rutas por calles de las ambulancias hacia su emergencia. Se calculan solas
 * (al despachar y al desviarse) escuchando el bus de eventos; el frontend
 * solo las consulta y las dibuja.
 */
@Module({
  imports: [AmbulancesModule, EmergenciesModule, AssignmentsModule],
  controllers: [RutasController],
  providers: [
    {
      provide: RutasAsignacionRepositorio,
      useClass: PrismaRutasAsignacionRepositorio,
    },
    {
      provide: ConfiguracionRutas,
      inject: [ConfigService],
      useFactory: (configuracion: Configuracion): ConfiguracionRutas => ({
        distanciaDesvioMetros:
          configuracion.get('RUTAS_DISTANCIA_DESVIO_M', { infer: true }) ??
          VALORES_POR_DEFECTO.distanciaDesvioMetros,
        intervaloRecalculoMs:
          (configuracion.get('RUTAS_INTERVALO_RECALCULO_S', { infer: true }) ??
            VALORES_POR_DEFECTO.intervaloRecalculoSegundos) * 1000,
      }),
    },
    {
      // Para sumar un proveedor: agregarlo a `inject` y a la lista `disponibles`.
      provide: ProveedoresRutas,
      inject: [ConfigService],
      useFactory: (configuracion: Configuracion) =>
        new RegistroProveedoresRutas(
          [
            new GeoapifyRutasProveedor(
              new ClienteGeoapify({
                apiKey:
                  configuracion.get('GEOAPIFY_API_KEY', { infer: true }) ??
                  null,
                tiempoEsperaMs:
                  configuracion.get('RUTAS_TIEMPO_ESPERA_MS', {
                    infer: true,
                  }) ?? VALORES_POR_DEFECTO.tiempoEsperaMs,
              }),
            ),
          ],
          (
            configuracion.get('RUTAS_PROVEEDORES', { infer: true }) ??
            VALORES_POR_DEFECTO.proveedores
          ).split(','),
        ),
    },
    CalcularRutaAsignacion,
    ObtenerRutaAsignacion,
    ConsultarRutasActivas,
    RecalculadorRutas,
  ],
  // El tiempo real arma con esto el evento `asignacion.ruta_actualizada`.
  exports: [ObtenerRutaAsignacion],
})
export class RoutingModule {}
