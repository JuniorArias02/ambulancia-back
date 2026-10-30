import { Module } from '@nestjs/common';
import { AmbulancesModule } from '../ambulances/ambulances.module.js';
import { AssignmentsModule } from '../assignments/assignments.module.js';
import { ConsultarRecorrido } from './application/use-cases/consultar_recorrido.use-case.js';
import { ReportarUbicacion } from './application/use-cases/reportar_ubicacion.use-case.js';
import { UbicacionesRepositorio } from './domain/repositories/ubicaciones.repository.js';
import { PrismaUbicacionesRepositorio } from './infrastructure/repositories/prisma_ubicaciones.repository.js';
import { UbicacionesController } from './presentation/controllers/ubicaciones.controller.js';

@Module({
  imports: [AmbulancesModule, AssignmentsModule],
  controllers: [UbicacionesController],
  providers: [
    { provide: UbicacionesRepositorio, useClass: PrismaUbicacionesRepositorio },
    ReportarUbicacion,
    ConsultarRecorrido,
  ],
})
export class LocationsModule {}
