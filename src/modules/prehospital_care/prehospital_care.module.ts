import { Module } from '@nestjs/common';
import { AmbulancesModule } from '../ambulances/ambulances.module.js';
import { AssignmentsModule } from '../assignments/assignments.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { DefinirDestinoAsignacion } from './application/use-cases/definir_destino_asignacion.use-case.js';
import { DestinoAsignacionController } from './presentation/controllers/destino_asignacion.controller.js';
import { AccesoHistoriaClinica } from './application/services/acceso_historia_clinica.service.js';
import { HuellaHistoria } from './application/services/huella_historia.service.js';
import { AbrirHistoriaClinica } from './application/use-cases/abrir_historia_clinica.use-case.js';
import { ActualizarHistoriaClinica } from './application/use-cases/actualizar_historia_clinica.use-case.js';
import { AnularHistoriaClinica } from './application/use-cases/anular_historia_clinica.use-case.js';
import { CerrarHistoriaClinica } from './application/use-cases/cerrar_historia_clinica.use-case.js';
import { ConsultarHistoriasClinicas } from './application/use-cases/consultar_historias_clinicas.use-case.js';
import { ObtenerHistoriaClinica } from './application/use-cases/obtener_historia_clinica.use-case.js';
import { RegistrarEnHistoria } from './application/use-cases/registrar_en_historia.use-case.js';
import { HistoriasClinicasRepositorio } from './domain/repositories/historias_clinicas.repository.js';
import { PrismaHistoriasClinicasRepositorio } from './infrastructure/repositories/prisma_historias_clinicas.repository.js';
import { HistoriasClinicasController } from './presentation/controllers/historias_clinicas.controller.js';
import { ActualizarInstitucionSalud } from './application/use-cases/actualizar_institucion_salud.use-case.js';
import { CambiarEstadoInstitucionSalud } from './application/use-cases/cambiar_estado_institucion_salud.use-case.js';
import { ConsultarInstitucionesSalud } from './application/use-cases/consultar_instituciones_salud.use-case.js';
import { CrearInstitucionSalud } from './application/use-cases/crear_institucion_salud.use-case.js';
import { ObtenerInstitucionSalud } from './application/use-cases/obtener_institucion_salud.use-case.js';
import { InstitucionesSaludRepositorio } from './domain/repositories/instituciones_salud.repository.js';
import { PrismaInstitucionesSaludRepositorio } from './infrastructure/repositories/prisma_instituciones_salud.repository.js';
import { InstitucionesSaludController } from './presentation/controllers/instituciones_salud.controller.js';

/** Atención prehospitalaria: historia clínica del paciente e instituciones de salud de destino. */
@Module({
  imports: [AuditModule, AssignmentsModule, AmbulancesModule],
  controllers: [
    InstitucionesSaludController,
    HistoriasClinicasController,
    DestinoAsignacionController,
  ],
  providers: [
    {
      provide: InstitucionesSaludRepositorio,
      useClass: PrismaInstitucionesSaludRepositorio,
    },
    CrearInstitucionSalud,
    ConsultarInstitucionesSalud,
    ObtenerInstitucionSalud,
    ActualizarInstitucionSalud,
    CambiarEstadoInstitucionSalud,
    DefinirDestinoAsignacion,
    {
      provide: HistoriasClinicasRepositorio,
      useClass: PrismaHistoriasClinicasRepositorio,
    },
    AccesoHistoriaClinica,
    HuellaHistoria,
    AbrirHistoriaClinica,
    ActualizarHistoriaClinica,
    ObtenerHistoriaClinica,
    ConsultarHistoriasClinicas,
    RegistrarEnHistoria,
    CerrarHistoriaClinica,
    AnularHistoriaClinica,
  ],
  exports: [InstitucionesSaludRepositorio],
})
export class PrehospitalCareModule {}
