import { Module } from '@nestjs/common';
import { AmbulancesModule } from '../ambulances/ambulances.module.js';
import { AssignmentsModule } from '../assignments/assignments.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuditoriaInventario } from './application/services/auditoria_inventario.service.js';
import { ReferenciasInventario } from './application/services/referencias_inventario.service.js';
import { UbicacionDelParamedico } from './application/services/ubicacion_del_paramedico.service.js';
import { ConsultarAlertasInventario } from './application/use-cases/consultar_alertas_inventario.use-case.js';
import { ConsultarExistencias } from './application/use-cases/consultar_existencias.use-case.js';
import { ConsultarMovimientos } from './application/use-cases/consultar_movimientos.use-case.js';
import { ConsultarVerificaciones } from './application/use-cases/consultar_verificaciones.use-case.js';
import { GestionarBodegas } from './application/use-cases/gestionar_bodegas.use-case.js';
import { GestionarEquipos } from './application/use-cases/gestionar_equipos.use-case.js';
import { GestionarEstadoMovimiento } from './application/use-cases/gestionar_estado_movimiento.use-case.js';
import { GestionarInsumos } from './application/use-cases/gestionar_insumos.use-case.js';
import { GestionarLotes } from './application/use-cases/gestionar_lotes.use-case.js';
import { GestionarPerfilesDotacion } from './application/use-cases/gestionar_perfiles_dotacion.use-case.js';
import { GestionarRegistrosSanitarios } from './application/use-cases/gestionar_registros_sanitarios.use-case.js';
import { GestionarUbicaciones } from './application/use-cases/gestionar_ubicaciones.use-case.js';
import { OperarInventarioAmbulancia } from './application/use-cases/operar_inventario_ambulancia.use-case.js';
import { RegistrarControlAlmacenamiento } from './application/use-cases/registrar_control_almacenamiento.use-case.js';
import { RegistrarMovimiento } from './application/use-cases/registrar_movimiento.use-case.js';
import { RevisarVerificacion } from './application/use-cases/revisar_verificacion.use-case.js';
import { VerificarInventarioAmbulancia } from './application/use-cases/verificar_inventario_ambulancia.use-case.js';
import { AlertasInventarioRepositorio } from './domain/repositories/alertas_inventario.repository.js';
import { BodegasRepositorio } from './domain/repositories/bodegas.repository.js';
import { ControlesAlmacenamientoRepositorio } from './domain/repositories/controles_almacenamiento.repository.js';
import { EquiposRepositorio } from './domain/repositories/equipos.repository.js';
import { ExistenciasRepositorio } from './domain/repositories/existencias.repository.js';
import { InsumosRepositorio } from './domain/repositories/insumos.repository.js';
import { LotesRepositorio } from './domain/repositories/lotes.repository.js';
import { MovimientosRepositorio } from './domain/repositories/movimientos.repository.js';
import { PerfilesDotacionRepositorio } from './domain/repositories/perfiles_dotacion.repository.js';
import { RegistrosSanitariosRepositorio } from './domain/repositories/registros_sanitarios.repository.js';
import { UbicacionesInventarioRepositorio } from './domain/repositories/ubicaciones_inventario.repository.js';
import { VerificacionesRepositorio } from './domain/repositories/verificaciones.repository.js';
import { PrismaAlertasInventarioRepositorio } from './infrastructure/repositories/prisma_alertas_inventario.repository.js';
import { PrismaBodegasRepositorio } from './infrastructure/repositories/prisma_bodegas.repository.js';
import { PrismaControlesAlmacenamientoRepositorio } from './infrastructure/repositories/prisma_controles_almacenamiento.repository.js';
import { PrismaEquiposRepositorio } from './infrastructure/repositories/prisma_equipos.repository.js';
import { PrismaExistenciasRepositorio } from './infrastructure/repositories/prisma_existencias.repository.js';
import { PrismaInsumosRepositorio } from './infrastructure/repositories/prisma_insumos.repository.js';
import { PrismaLotesRepositorio } from './infrastructure/repositories/prisma_lotes.repository.js';
import { PrismaMovimientosRepositorio } from './infrastructure/repositories/prisma_movimientos.repository.js';
import { PrismaPerfilesDotacionRepositorio } from './infrastructure/repositories/prisma_perfiles_dotacion.repository.js';
import { PrismaRegistrosSanitariosRepositorio } from './infrastructure/repositories/prisma_registros_sanitarios.repository.js';
import { PrismaUbicacionesInventarioRepositorio } from './infrastructure/repositories/prisma_ubicaciones_inventario.repository.js';
import { PrismaVerificacionesRepositorio } from './infrastructure/repositories/prisma_verificaciones.repository.js';
import { BodegasUbicacionesController } from './presentation/controllers/bodegas_ubicaciones.controller.js';
import { CatalogoInventarioController } from './presentation/controllers/catalogo_inventario.controller.js';
import { ControlesVerificacionesController } from './presentation/controllers/controles_verificaciones.controller.js';
import { LotesEquiposController } from './presentation/controllers/lotes_equipos.controller.js';
import { MiInventarioController } from './presentation/controllers/mi_inventario.controller.js';
import { MovimientosController } from './presentation/controllers/movimientos.controller.js';
import { PerfilesDotacionController } from './presentation/controllers/perfiles_dotacion.controller.js';

/**
 * Inventario de bodegas y ambulancias (docs/bd-inventario.md). La web
 * (administrador y despachador) administra; el paramédico opera el inventario
 * de la ambulancia de su turno desde la app.
 */
@Module({
  // Ambulancias: turno del paramédico, tipo de ambulancia. Asignaciones: consumos por servicio.
  imports: [AuditModule, AmbulancesModule, AssignmentsModule, UsersModule],
  controllers: [
    CatalogoInventarioController,
    BodegasUbicacionesController,
    LotesEquiposController,
    MovimientosController,
    PerfilesDotacionController,
    ControlesVerificacionesController,
    MiInventarioController,
  ],
  providers: [
    { provide: InsumosRepositorio, useClass: PrismaInsumosRepositorio },
    {
      provide: RegistrosSanitariosRepositorio,
      useClass: PrismaRegistrosSanitariosRepositorio,
    },
    { provide: BodegasRepositorio, useClass: PrismaBodegasRepositorio },
    {
      provide: UbicacionesInventarioRepositorio,
      useClass: PrismaUbicacionesInventarioRepositorio,
    },
    { provide: LotesRepositorio, useClass: PrismaLotesRepositorio },
    { provide: EquiposRepositorio, useClass: PrismaEquiposRepositorio },
    { provide: ExistenciasRepositorio, useClass: PrismaExistenciasRepositorio },
    { provide: MovimientosRepositorio, useClass: PrismaMovimientosRepositorio },
    {
      provide: PerfilesDotacionRepositorio,
      useClass: PrismaPerfilesDotacionRepositorio,
    },
    {
      provide: VerificacionesRepositorio,
      useClass: PrismaVerificacionesRepositorio,
    },
    {
      provide: ControlesAlmacenamientoRepositorio,
      useClass: PrismaControlesAlmacenamientoRepositorio,
    },
    {
      provide: AlertasInventarioRepositorio,
      useClass: PrismaAlertasInventarioRepositorio,
    },
    AuditoriaInventario,
    ReferenciasInventario,
    UbicacionDelParamedico,
    GestionarInsumos,
    GestionarRegistrosSanitarios,
    GestionarBodegas,
    GestionarUbicaciones,
    GestionarLotes,
    GestionarEquipos,
    RegistrarMovimiento,
    GestionarEstadoMovimiento,
    ConsultarMovimientos,
    ConsultarExistencias,
    ConsultarAlertasInventario,
    GestionarPerfilesDotacion,
    RegistrarControlAlmacenamiento,
    OperarInventarioAmbulancia,
    VerificarInventarioAmbulancia,
    ConsultarVerificaciones,
    RevisarVerificacion,
  ],
})
export class InventoryModule {}
