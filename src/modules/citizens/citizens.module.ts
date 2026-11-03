import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { VariablesEntorno } from '../../config/variables_entorno.js';
import { AuditModule } from '../audit/audit.module.js';
import { EmergenciesModule } from '../emergencies/emergencies.module.js';
import { GeocodingModule } from '../geocoding/geocoding.module.js';
import { UsersModule } from '../users/users.module.js';
import { DocumentosCargados } from './application/services/documentos_cargados.service.js';
import { ConsultarAccesoCiudadano } from './application/use-cases/consultar_acceso_ciudadano.use-case.js';
import { ActualizarContactoCiudadano } from './application/use-cases/actualizar_contacto_ciudadano.use-case.js';
import { ConsultarMisEmergencias } from './application/use-cases/consultar_mis_emergencias.use-case.js';
import { ConsultarVerificaciones } from './application/use-cases/consultar_verificaciones.use-case.js';
import { DecidirVerificacion } from './application/use-cases/decidir_verificacion.use-case.js';
import { ObtenerCiudadano } from './application/use-cases/obtener_ciudadano.use-case.js';
import { ObtenerDocumentoIdentidad } from './application/use-cases/obtener_documento_identidad.use-case.js';
import { ObtenerVerificacion } from './application/use-cases/obtener_verificacion.use-case.js';
import { ReenviarVerificacion } from './application/use-cases/reenviar_verificacion.use-case.js';
import { RegistrarCiudadano } from './application/use-cases/registrar_ciudadano.use-case.js';
import { ReportarEmergenciaCiudadana } from './application/use-cases/reportar_emergencia_ciudadana.use-case.js';
import { CiudadanosRepositorio } from './domain/repositories/ciudadanos.repository.js';
import { AlmacenamientoDocumentos } from './domain/services/almacenamiento_documentos.js';
import { PrismaCiudadanosRepositorio } from './infrastructure/repositories/prisma_ciudadanos.repository.js';
import { AlmacenamientoSistemaArchivos } from './infrastructure/services/almacenamiento_sistema_archivos.service.js';
import { CiudadanosController } from './presentation/controllers/ciudadanos.controller.js';
import { EmergenciasCiudadanasController } from './presentation/controllers/emergencias_ciudadanas.controller.js';
import { VerificacionesCiudadanosController } from './presentation/controllers/verificaciones_ciudadanos.controller.js';

/**
 * Ciudadanos: registro, verificación documental de identidad y reportes de
 * emergencia. Reutiliza usuarios (hash), emergencias (registro y numeración)
 * y geocodificación; no despacha ambulancias.
 */
@Module({
  imports: [AuditModule, UsersModule, EmergenciesModule, GeocodingModule],
  controllers: [
    CiudadanosController,
    EmergenciasCiudadanasController,
    VerificacionesCiudadanosController,
  ],
  providers: [
    { provide: CiudadanosRepositorio, useClass: PrismaCiudadanosRepositorio },
    {
      provide: AlmacenamientoDocumentos,
      inject: [ConfigService],
      useFactory: (configuracion: ConfigService<VariablesEntorno, true>) =>
        new AlmacenamientoSistemaArchivos(
          configuracion.get('ALMACENAMIENTO_PRIVADO_RUTA', { infer: true }) ??
            'almacenamiento-privado',
        ),
    },
    DocumentosCargados,
    RegistrarCiudadano,
    ObtenerCiudadano,
    ActualizarContactoCiudadano,
    ReenviarVerificacion,
    ConsultarVerificaciones,
    ObtenerVerificacion,
    ObtenerDocumentoIdentidad,
    DecidirVerificacion,
    ReportarEmergenciaCiudadana,
    ConsultarMisEmergencias,
    ConsultarAccesoCiudadano,
  ],
})
export class CitizensModule {}
