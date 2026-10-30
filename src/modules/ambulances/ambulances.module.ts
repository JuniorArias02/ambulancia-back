import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { UsersModule } from '../users/users.module.js';
import { ValidadorTripulacion } from './application/services/validador_tripulacion.service.js';
import { ConsultarTurnos } from './application/use-cases/consultar_turnos.use-case.js';
import { FinalizarTurno } from './application/use-cases/finalizar_turno.use-case.js';
import { IniciarTurno } from './application/use-cases/iniciar_turno.use-case.js';
import { ObtenerTurno } from './application/use-cases/obtener_turno.use-case.js';
import { ReemplazarIntegrantesTurno } from './application/use-cases/reemplazar_integrantes_turno.use-case.js';
import { TurnosRepositorio } from './domain/repositories/turnos.repository.js';
import { PrismaTurnosRepositorio } from './infrastructure/repositories/prisma_turnos.repository.js';
import { TurnosController } from './presentation/controllers/turnos.controller.js';
import { ActualizarAmbulancia } from './application/use-cases/actualizar_ambulancia.use-case.js';
import { CambiarEstadoAmbulancia } from './application/use-cases/cambiar_estado_ambulancia.use-case.js';
import { ConsultarAmbulancias } from './application/use-cases/consultar_ambulancias.use-case.js';
import { ConsultarHistorialEstadosAmbulancia } from './application/use-cases/consultar_historial_estados_ambulancia.use-case.js';
import { ConsultarTiposAmbulancia } from './application/use-cases/consultar_tipos_ambulancia.use-case.js';
import { CrearAmbulancia } from './application/use-cases/crear_ambulancia.use-case.js';
import { ObtenerAmbulancia } from './application/use-cases/obtener_ambulancia.use-case.js';
import { AmbulanciasRepositorio } from './domain/repositories/ambulancias.repository.js';
import { TiposAmbulanciaRepositorio } from './domain/repositories/tipos_ambulancia.repository.js';
import { PrismaAmbulanciasRepositorio } from './infrastructure/repositories/prisma_ambulancias.repository.js';
import { PrismaTiposAmbulanciaRepositorio } from './infrastructure/repositories/prisma_tipos_ambulancia.repository.js';
import { AmbulanciasController } from './presentation/controllers/ambulancias.controller.js';
import { TiposAmbulanciaController } from './presentation/controllers/tipos_ambulancia.controller.js';

@Module({
  imports: [AuditModule, UsersModule],
  controllers: [
    AmbulanciasController,
    TiposAmbulanciaController,
    TurnosController,
  ],
  providers: [
    { provide: AmbulanciasRepositorio, useClass: PrismaAmbulanciasRepositorio },
    {
      provide: TiposAmbulanciaRepositorio,
      useClass: PrismaTiposAmbulanciaRepositorio,
    },
    CrearAmbulancia,
    ConsultarAmbulancias,
    ObtenerAmbulancia,
    ActualizarAmbulancia,
    CambiarEstadoAmbulancia,
    ConsultarHistorialEstadosAmbulancia,
    ConsultarTiposAmbulancia,
    { provide: TurnosRepositorio, useClass: PrismaTurnosRepositorio },
    ValidadorTripulacion,
    IniciarTurno,
    ConsultarTurnos,
    ObtenerTurno,
    ReemplazarIntegrantesTurno,
    FinalizarTurno,
  ],
  // Asignaciones y ubicaciones los usan para despachar y ubicar a la tripulación;
  // el tiempo real, para recargar la ambulancia y el turno.
  exports: [
    AmbulanciasRepositorio,
    TurnosRepositorio,
    ObtenerAmbulancia,
    ObtenerTurno,
  ],
})
export class AmbulancesModule {}
