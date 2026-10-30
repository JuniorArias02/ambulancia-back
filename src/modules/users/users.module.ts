import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { ActualizarUsuario } from './application/use-cases/actualizar_usuario.use-case.js';
import { AsignarRolUsuario } from './application/use-cases/asignar_rol_usuario.use-case.js';
import { CambiarEstadoUsuario } from './application/use-cases/cambiar_estado_usuario.use-case.js';
import { ConsultarRoles } from './application/use-cases/consultar_roles.use-case.js';
import { ConsultarUsuarios } from './application/use-cases/consultar_usuarios.use-case.js';
import { CrearUsuario } from './application/use-cases/crear_usuario.use-case.js';
import { ObtenerUsuario } from './application/use-cases/obtener_usuario.use-case.js';
import { RolesRepositorio } from './domain/repositories/roles.repository.js';
import { UsuariosRepositorio } from './domain/repositories/usuarios.repository.js';
import { HashContrasena } from './domain/services/hash_contrasena.service.js';
import { PrismaRolesRepositorio } from './infrastructure/repositories/prisma_roles.repository.js';
import { PrismaUsuariosRepositorio } from './infrastructure/repositories/prisma_usuarios.repository.js';
import { Argon2HashContrasena } from './infrastructure/services/argon2_hash_contrasena.service.js';
import { RolesController } from './presentation/controllers/roles.controller.js';
import { UsuariosController } from './presentation/controllers/usuarios.controller.js';

@Module({
  imports: [AuditModule],
  controllers: [UsuariosController, RolesController],
  providers: [
    { provide: UsuariosRepositorio, useClass: PrismaUsuariosRepositorio },
    { provide: RolesRepositorio, useClass: PrismaRolesRepositorio },
    { provide: HashContrasena, useClass: Argon2HashContrasena },
    CrearUsuario,
    ConsultarUsuarios,
    ObtenerUsuario,
    ActualizarUsuario,
    CambiarEstadoUsuario,
    AsignarRolUsuario,
    ConsultarRoles,
  ],
  exports: [UsuariosRepositorio, HashContrasena],
})
export class UsersModule {}
