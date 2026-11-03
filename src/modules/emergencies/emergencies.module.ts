import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { ActualizarEmergencia } from './application/use-cases/actualizar_emergencia.use-case.js';
import { BuscarPosiblesDuplicadas } from './application/use-cases/buscar_posibles_duplicadas.use-case.js';
import { CancelarEmergencia } from './application/use-cases/cancelar_emergencia.use-case.js';
import { ConsultarEmergencias } from './application/use-cases/consultar_emergencias.use-case.js';
import { MarcarEmergenciaDuplicada } from './application/use-cases/marcar_emergencia_duplicada.use-case.js';
import { ObtenerEmergencia } from './application/use-cases/obtener_emergencia.use-case.js';
import { RegistrarEmergencia } from './application/use-cases/registrar_emergencia.use-case.js';
import { EmergenciasRepositorio } from './domain/repositories/emergencias.repository.js';
import { PrismaEmergenciasRepositorio } from './infrastructure/repositories/prisma_emergencias.repository.js';
import { EmergenciasController } from './presentation/controllers/emergencias.controller.js';

@Module({
  imports: [AuditModule],
  controllers: [EmergenciasController],
  providers: [
    { provide: EmergenciasRepositorio, useClass: PrismaEmergenciasRepositorio },
    RegistrarEmergencia,
    ConsultarEmergencias,
    ObtenerEmergencia,
    ActualizarEmergencia,
    CancelarEmergencia,
    MarcarEmergenciaDuplicada,
    BuscarPosiblesDuplicadas,
  ],
  // Las asignaciones lo usan para despachar y cerrar emergencias; el tiempo
  // real, para recargar la emergencia y sugerir duplicados.
  // Los ciudadanos reportan con el mismo registro que usa la central.
  exports: [
    EmergenciasRepositorio,
    RegistrarEmergencia,
    ObtenerEmergencia,
    BuscarPosiblesDuplicadas,
  ],
})
export class EmergenciesModule {}
