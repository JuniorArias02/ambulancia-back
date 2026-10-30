import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { VariablesEntorno } from '../../config/variables_entorno.js';
import { AmbulancesModule } from '../ambulances/ambulances.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { EmergenciesModule } from '../emergencies/emergencies.module.js';
import { ConfiguracionAsignaciones } from './application/configuracion_asignaciones.js';
import { PermisoServicio } from './application/services/permiso_servicio.service.js';
import { AvanzarAsignacion } from './application/use-cases/avanzar_asignacion.use-case.js';
import { ConsultarEventosAsignacion } from './application/use-cases/consultar_eventos_asignacion.use-case.js';
import { CancelarAsignacion } from './application/use-cases/cancelar_asignacion.use-case.js';
import { ConsultarAsignaciones } from './application/use-cases/consultar_asignaciones.use-case.js';
import { DespacharAmbulancia } from './application/use-cases/despachar_ambulancia.use-case.js';
import { ObtenerAsignacion } from './application/use-cases/obtener_asignacion.use-case.js';
import { ObtenerMiServicio } from './application/use-cases/obtener_mi_servicio.use-case.js';
import { AsignacionesRepositorio } from './domain/repositories/asignaciones.repository.js';
import { PrismaAsignacionesRepositorio } from './infrastructure/repositories/prisma_asignaciones.repository.js';
import { AsignacionesController } from './presentation/controllers/asignaciones.controller.js';
import { MiServicioController } from './presentation/controllers/mi_servicio.controller.js';

@Module({
  imports: [AuditModule, AmbulancesModule, EmergenciesModule],
  controllers: [AsignacionesController, MiServicioController],
  providers: [
    {
      provide: AsignacionesRepositorio,
      useClass: PrismaAsignacionesRepositorio,
    },
    {
      provide: ConfiguracionAsignaciones,
      inject: [ConfigService],
      useFactory: (
        configuracion: ConfigService<VariablesEntorno, true>,
      ): ConfiguracionAsignaciones => ({
        radioLlegadaMetros:
          configuracion.get('ASIGNACIONES_RADIO_LLEGADA_M', { infer: true }) ??
          100,
      }),
    },
    PermisoServicio,
    DespacharAmbulancia,
    ConsultarAsignaciones,
    ConsultarEventosAsignacion,
    ObtenerAsignacion,
    AvanzarAsignacion,
    CancelarAsignacion,
    ObtenerMiServicio,
  ],
  // Ubicaciones lo usa para asociar cada posición al servicio en curso; el
  // tiempo real, para avisar a la central y a la tripulación.
  exports: [
    AsignacionesRepositorio,
    ObtenerAsignacion,
    ConsultarAsignaciones,
    ObtenerMiServicio,
  ],
})
export class AssignmentsModule {}
