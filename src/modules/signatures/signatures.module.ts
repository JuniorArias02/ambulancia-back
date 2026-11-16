import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { VariablesEntorno } from '../../config/variables_entorno.js';
import { AuditModule } from '../audit/audit.module.js';
import { UsersModule } from '../users/users.module.js';
import { LectorImagenFirma } from './application/services/lector_imagen_firma.service.js';
import { ConsultarFirmasUsuario } from './application/use-cases/consultar_firmas_usuario.use-case.js';
import { DesactivarFirma } from './application/use-cases/desactivar_firma.use-case.js';
import { ObtenerImagenFirma } from './application/use-cases/obtener_imagen_firma.use-case.js';
import { ObtenerMiFirma } from './application/use-cases/obtener_mi_firma.use-case.js';
import { RegistrarMiFirma } from './application/use-cases/registrar_mi_firma.use-case.js';
import { FirmasUsuariosRepositorio } from './domain/repositories/firmas_usuarios.repository.js';
import { AlmacenamientoFirmas } from './domain/services/almacenamiento_firmas.js';
import { PrismaFirmasUsuariosRepositorio } from './infrastructure/repositories/prisma_firmas_usuarios.repository.js';
import {
  AlmacenamientoFirmasCifrado,
  clavesDesdeEntorno,
} from './infrastructure/services/almacenamiento_firmas_cifrado.service.js';
import { FirmasUsuariosController } from './presentation/controllers/firmas_usuarios.controller.js';
import { MiFirmaController } from './presentation/controllers/mi_firma.controller.js';

/**
 * Firmas registradas de los profesionales: imagen cifrada en el disco del
 * servidor y sus datos en `firmas_usuarios`. La historia clínica usa el
 * repositorio y el lector para estampar y mostrar la firma.
 */
@Module({
  imports: [AuditModule, UsersModule],
  controllers: [MiFirmaController, FirmasUsuariosController],
  providers: [
    {
      provide: FirmasUsuariosRepositorio,
      useClass: PrismaFirmasUsuariosRepositorio,
    },
    {
      provide: AlmacenamientoFirmas,
      inject: [ConfigService],
      useFactory: (configuracion: ConfigService<VariablesEntorno, true>) =>
        new AlmacenamientoFirmasCifrado(
          configuracion.get('ALMACENAMIENTO_PRIVADO_RUTA', { infer: true }) ??
            'almacenamiento-privado',
          clavesDesdeEntorno({
            clave: configuracion.get('FIRMAS_CLAVE_CIFRADO', { infer: true }),
            version: configuracion.get('FIRMAS_CLAVE_VERSION', { infer: true }),
            anteriores: configuracion.get('FIRMAS_CLAVES_ANTERIORES', {
              infer: true,
            }),
          }),
        ),
    },
    LectorImagenFirma,
    RegistrarMiFirma,
    ObtenerMiFirma,
    ObtenerImagenFirma,
    ConsultarFirmasUsuario,
    DesactivarFirma,
  ],
  exports: [FirmasUsuariosRepositorio, LectorImagenFirma, AlmacenamientoFirmas],
})
export class SignaturesModule {}
