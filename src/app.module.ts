import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { FiltroExcepciones } from './common/filters/filtro_excepciones.filter.js';
import { JwtAutenticacionGuard } from './common/guards/jwt_autenticacion.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { EventosModule } from './common/events/eventos.module.js';
import { validarVariablesEntorno } from './config/variables_entorno.js';
import { PrismaModule } from './database/prisma.module.js';
import { AmbulancesModule } from './modules/ambulances/ambulances.module.js';
import { AssignmentsModule } from './modules/assignments/assignments.module.js';
import { LocationsModule } from './modules/locations/locations.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { PrehospitalCareModule } from './modules/prehospital_care/prehospital_care.module.js';
import { RoutingModule } from './modules/routing/routing.module.js';
import { GeocodingModule } from './modules/geocoding/geocoding.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { EmergenciesModule } from './modules/emergencies/emergencies.module.js';
import { AuthenticationModule } from './modules/authentication/authentication.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validarVariablesEntorno,
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    PrismaModule,
    EventosModule,
    AuditModule,
    UsersModule,
    AuthenticationModule,
    AmbulancesModule,
    EmergenciesModule,
    AssignmentsModule,
    LocationsModule,
    PrehospitalCareModule,
    GeocodingModule,
    RoutingModule,
    NotificationsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: FiltroExcepciones },
    // El orden importa: límite de solicitudes, autenticación y luego roles.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAutenticacionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
