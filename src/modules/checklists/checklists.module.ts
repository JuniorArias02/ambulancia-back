import { Module } from '@nestjs/common';
import { AmbulancesModule } from '../ambulances/ambulances.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AmbulanciaDelConductor } from './application/services/ambulancia_del_conductor.service.js';
import { ActualizarListaChequeo } from './application/use-cases/actualizar_lista_chequeo.use-case.js';
import { CambiarEstadoListaChequeo } from './application/use-cases/cambiar_estado_lista_chequeo.use-case.js';
import { ConsultarChequeosDiarios } from './application/use-cases/consultar_chequeos_diarios.use-case.js';
import { ConsultarListasChequeo } from './application/use-cases/consultar_listas_chequeo.use-case.js';
import { CrearListaChequeo } from './application/use-cases/crear_lista_chequeo.use-case.js';
import { FinalizarChequeoDiario } from './application/use-cases/finalizar_chequeo_diario.use-case.js';
import { GestionarOpcionesListaChequeo } from './application/use-cases/gestionar_opciones_lista_chequeo.use-case.js';
import { GestionarPreguntasListaChequeo } from './application/use-cases/gestionar_preguntas_lista_chequeo.use-case.js';
import { IniciarChequeoDiario } from './application/use-cases/iniciar_chequeo_diario.use-case.js';
import { ObtenerMiChequeoDelDia } from './application/use-cases/obtener_mi_chequeo_del_dia.use-case.js';
import { ResponderChequeoDiario } from './application/use-cases/responder_chequeo_diario.use-case.js';
import { ChequeosDiariosRepositorio } from './domain/repositories/chequeos_diarios.repository.js';
import { ListasChequeoRepositorio } from './domain/repositories/listas_chequeo.repository.js';
import { PrismaChequeosDiariosRepositorio } from './infrastructure/repositories/prisma_chequeos_diarios.repository.js';
import { PrismaListasChequeoRepositorio } from './infrastructure/repositories/prisma_listas_chequeo.repository.js';
import { ChequeosDiariosController } from './presentation/controllers/chequeos_diarios.controller.js';
import { ListasChequeoController } from './presentation/controllers/listas_chequeo.controller.js';
import { MiChequeoDiarioController } from './presentation/controllers/mi_chequeo_diario.controller.js';

/**
 * Lista de chequeo diaria de la ambulancia: el administrador la configura y
 * el conductor la diligencia una vez al día por ambulancia.
 */
@Module({
  // AmbulancesModule exporta TurnosRepositorio: de ahí sale la ambulancia del conductor.
  imports: [AuditModule, AmbulancesModule],
  controllers: [
    ListasChequeoController,
    MiChequeoDiarioController,
    ChequeosDiariosController,
  ],
  providers: [
    {
      provide: ListasChequeoRepositorio,
      useClass: PrismaListasChequeoRepositorio,
    },
    {
      provide: ChequeosDiariosRepositorio,
      useClass: PrismaChequeosDiariosRepositorio,
    },
    AmbulanciaDelConductor,
    CrearListaChequeo,
    ConsultarListasChequeo,
    ActualizarListaChequeo,
    CambiarEstadoListaChequeo,
    GestionarPreguntasListaChequeo,
    GestionarOpcionesListaChequeo,
    ObtenerMiChequeoDelDia,
    IniciarChequeoDiario,
    ResponderChequeoDiario,
    FinalizarChequeoDiario,
    ConsultarChequeosDiarios,
  ],
})
export class ChecklistsModule {}
