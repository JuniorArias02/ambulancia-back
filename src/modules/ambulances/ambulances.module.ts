import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { ConsultarAmbulanciasSeleccionables } from './application/use-cases/consultar_ambulancias_seleccionables.use-case.js';
import { ConsultarTurnos } from './application/use-cases/consultar_turnos.use-case.js';
import { FinalizarTurno } from './application/use-cases/finalizar_turno.use-case.js';
import { ObtenerTurno } from './application/use-cases/obtener_turno.use-case.js';
import { SalirDeAmbulancia } from './application/use-cases/salir_de_ambulancia.use-case.js';
import { SeleccionarAmbulancia } from './application/use-cases/seleccionar_ambulancia.use-case.js';
import { TurnosRepositorio } from './domain/repositories/turnos.repository.js';
import { PrismaTurnosRepositorio } from './infrastructure/repositories/prisma_turnos.repository.js';
import { MiAmbulanciaController } from './presentation/controllers/mi_ambulancia.controller.js';
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
  imports: [AuditModule],
  controllers: [
    AmbulanciasController,
    TiposAmbulanciaController,
    TurnosController,
    MiAmbulanciaController,
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
    ConsultarTurnos,
    ObtenerTurno,
    FinalizarTurno,
    SeleccionarAmbulancia,
    SalirDeAmbulancia,
    ConsultarAmbulanciasSeleccionables,
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
