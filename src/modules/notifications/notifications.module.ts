import { Module } from '@nestjs/common';
import { AmbulancesModule } from '../ambulances/ambulances.module.js';
import { AssignmentsModule } from '../assignments/assignments.module.js';
import { CitizensModule } from '../citizens/citizens.module.js';
import { EmergenciesModule } from '../emergencies/emergencies.module.js';
import { RoutingModule } from '../routing/routing.module.js';
import { LimitadorUbicaciones } from './application/services/limitador_ubicaciones.js';
import { EmisorHttpTiempoReal } from './infrastructure/services/emisor_http_tiempo_real.service.js';
import { EmisorTiempoReal } from './presentation/listeners/emisor_tiempo_real.js';
import { NotificadorTiempoReal } from './presentation/listeners/notificador_tiempo_real.listener.js';
import { NotificadorSeguimientoCiudadano } from './presentation/listeners/notificador_seguimiento_ciudadano.listener.js';

/**
 * Decide qué se notifica y a quién, y lo entrega al servidor de tiempo real
 * (`webSocket/`). Escucha los eventos de dominio en vez de ser llamado por los
 * casos de uso: así los demás módulos no dependen de este.
 */
@Module({
  imports: [
    AmbulancesModule,
    EmergenciesModule,
    AssignmentsModule,
    RoutingModule,
    CitizensModule,
  ],
  providers: [
    { provide: EmisorTiempoReal, useClass: EmisorHttpTiempoReal },
    LimitadorUbicaciones,
    NotificadorTiempoReal,
    NotificadorSeguimientoCiudadano,
  ],
})
export class NotificationsModule {}
