import { Module } from '@nestjs/common';
import { AmbulancesModule } from '../ambulances/ambulances.module.js';
import { AssignmentsModule } from '../assignments/assignments.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { UsersModule } from '../users/users.module.js';
import { ConfigService } from '@nestjs/config';
import type { VariablesEntorno } from '../../config/variables_entorno.js';
import { SignaturesModule } from '../signatures/signatures.module.js';
import { PoliticaFirmaCierre } from './application/services/politica_firma_cierre.js';
import { ObtenerFirmaCierre } from './application/use-cases/obtener_firma_cierre.use-case.js';
import { BuscarHistoriasClinicas } from './application/use-cases/buscar_historias_clinicas.use-case.js';
import { ConsultarTrazabilidadHistoria } from './application/use-cases/consultar_trazabilidad_historia.use-case.js';
import { ObtenerIngreso } from './application/use-cases/obtener_ingreso.use-case.js';
import { ConsultaClinicaRepositorio } from './domain/repositories/consulta_clinica.repository.js';
import { PrismaConsultaClinicaRepositorio } from './infrastructure/repositories/prisma_consulta_clinica.repository.js';
import { ConsultaClinicaController } from './presentation/controllers/consulta_clinica.controller.js';
import { FirmasHistoriaController } from './presentation/controllers/firmas_historia.controller.js';
import { ExportarHistoriaPdf } from './application/use-cases/exportar_historia_pdf.use-case.js';
import { BuscarPacientes } from './application/use-cases/buscar_pacientes.use-case.js';
import { ConsultarIndicadoresClinicos } from './application/use-cases/consultar_indicadores_clinicos.use-case.js';
import { ExportarHistoriasCsv } from './application/use-cases/exportar_historias_csv.use-case.js';
import { ObtenerFichaPaciente } from './application/use-cases/obtener_ficha_paciente.use-case.js';
import { IndicePacientes } from './domain/repositories/indice_pacientes.repository.js';
import { PrismaIndicePacientes } from './infrastructure/repositories/prisma_indice_pacientes.repository.js';
import { GeneradorPdfHistoria } from './domain/services/generador_pdf_historia.js';
import { PdfkitGeneradorHistoria } from './infrastructure/services/pdfkit_generador_historia.service.js';
import { ObtenerImagenFirmaHistoria } from './application/use-cases/obtener_imagen_firma_historia.use-case.js';
import { QuitarFirmaHistoria } from './application/use-cases/quitar_firma_historia.use-case.js';
import { RegistrarFirmaHistoria } from './application/use-cases/registrar_firma_historia.use-case.js';
import { FirmaElectronicaHistoria } from './application/services/firma_electronica.service.js';
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
import { ConsultarValoracionesDownton } from './application/use-cases/consultar_valoraciones_downton.use-case.js';
import { ObtenerValoracionDownton } from './application/use-cases/obtener_valoracion_downton.use-case.js';
import { RegistrarValoracionDownton } from './application/use-cases/registrar_valoracion_downton.use-case.js';
import { ValoracionesDowntonController } from './presentation/controllers/valoraciones_downton.controller.js';
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
  imports: [
    AuditModule,
    AssignmentsModule,
    AmbulancesModule,
    UsersModule,
    SignaturesModule,
  ],
  controllers: [
    InstitucionesSaludController,
    HistoriasClinicasController,
    ValoracionesDowntonController,
    DestinoAsignacionController,
    ConsultaClinicaController,
    FirmasHistoriaController,
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
    FirmaElectronicaHistoria,
    {
      provide: PoliticaFirmaCierre,
      inject: [ConfigService],
      useFactory: (configuracion: ConfigService<VariablesEntorno, true>) =>
        new PoliticaFirmaCierre(
          configuracion.get('FIRMA_CIERRE_OBLIGATORIA', { infer: true }) !==
            'false',
        ),
    },
    ObtenerFirmaCierre,
    {
      provide: ConsultaClinicaRepositorio,
      useClass: PrismaConsultaClinicaRepositorio,
    },
    BuscarHistoriasClinicas,
    ObtenerIngreso,
    ConsultarTrazabilidadHistoria,
    RegistrarFirmaHistoria,
    ObtenerImagenFirmaHistoria,
    QuitarFirmaHistoria,
    {
      provide: GeneradorPdfHistoria,
      inject: [ConfigService],
      useFactory: (configuracion: ConfigService<VariablesEntorno, true>) =>
        new PdfkitGeneradorHistoria(
          configuracion.get('NOMBRE_EMPRESA', { infer: true }) ??
            'Ambulancias Galenos',
        ),
    },
    ExportarHistoriaPdf,
    { provide: IndicePacientes, useClass: PrismaIndicePacientes },
    BuscarPacientes,
    ObtenerFichaPaciente,
    ConsultarIndicadoresClinicos,
    ExportarHistoriasCsv,
    AbrirHistoriaClinica,
    ActualizarHistoriaClinica,
    ObtenerHistoriaClinica,
    ConsultarHistoriasClinicas,
    RegistrarEnHistoria,
    CerrarHistoriaClinica,
    AnularHistoriaClinica,
    RegistrarValoracionDownton,
    ConsultarValoracionesDownton,
    ObtenerValoracionDownton,
  ],
  exports: [InstitucionesSaludRepositorio],
})
export class PrehospitalCareModule {}
