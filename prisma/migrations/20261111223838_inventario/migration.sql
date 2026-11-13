-- CreateTable
CREATE TABLE `inv_insumos` (
    `id` CHAR(36) NOT NULL,
    `codigo` VARCHAR(50) NOT NULL,
    `nombre` VARCHAR(150) NOT NULL,
    `descripcion` TEXT NULL,
    `tipo` VARCHAR(40) NOT NULL,
    `categoria` VARCHAR(100) NULL,
    `unidad_medida` VARCHAR(30) NOT NULL,
    `marca` VARCHAR(100) NULL,
    `fabricante` VARCHAR(150) NULL,
    `requiere_lote` BOOLEAN NOT NULL DEFAULT true,
    `requiere_vencimiento` BOOLEAN NOT NULL DEFAULT false,
    `requiere_registro_sanitario` BOOLEAN NOT NULL DEFAULT false,
    `requiere_serie` BOOLEAN NOT NULL DEFAULT false,
    `es_control_especial` BOOLEAN NOT NULL DEFAULT false,
    `stock_minimo` DECIMAL(12, 3) NOT NULL DEFAULT 0,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizado_en` DATETIME(3) NOT NULL,

    UNIQUE INDEX `inv_insumos_codigo_key`(`codigo`),
    INDEX `inv_insumos_tipo_activo_idx`(`tipo`, `activo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inv_registros_sanitarios` (
    `id` CHAR(36) NOT NULL,
    `insumo_id` CHAR(36) NOT NULL,
    `numero_registro` VARCHAR(100) NOT NULL,
    `tipo_registro` VARCHAR(50) NOT NULL,
    `fecha_expedicion` DATE NULL,
    `fecha_vencimiento` DATE NULL,
    `titular` VARCHAR(150) NULL,
    `documento_url` VARCHAR(500) NULL,
    `estado` VARCHAR(30) NOT NULL DEFAULT 'vigente',
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizado_en` DATETIME(3) NOT NULL,

    INDEX `inv_registros_sanitarios_estado_fecha_vencimiento_idx`(`estado`, `fecha_vencimiento`),
    UNIQUE INDEX `inv_registros_sanitarios_insumo_id_numero_registro_key`(`insumo_id`, `numero_registro`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inv_bodegas` (
    `id` CHAR(36) NOT NULL,
    `codigo` VARCHAR(50) NOT NULL,
    `nombre` VARCHAR(150) NOT NULL,
    `ubicacion` VARCHAR(250) NULL,
    `responsable_id` CHAR(36) NULL,
    `activa` BOOLEAN NOT NULL DEFAULT true,
    `creada_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizada_en` DATETIME(3) NOT NULL,

    UNIQUE INDEX `inv_bodegas_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inv_ubicaciones` (
    `id` CHAR(36) NOT NULL,
    `tipo` VARCHAR(30) NOT NULL,
    `bodega_id` CHAR(36) NULL,
    `ambulancia_id` CHAR(36) NULL,
    `activa` BOOLEAN NOT NULL DEFAULT true,
    `creada_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizada_en` DATETIME(3) NOT NULL,

    UNIQUE INDEX `inv_ubicaciones_bodega_id_key`(`bodega_id`),
    UNIQUE INDEX `inv_ubicaciones_ambulancia_id_key`(`ambulancia_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inv_lotes` (
    `id` CHAR(36) NOT NULL,
    `insumo_id` CHAR(36) NOT NULL,
    `registro_sanitario_id` CHAR(36) NULL,
    `numero_lote` VARCHAR(100) NOT NULL,
    `fecha_fabricacion` DATE NULL,
    `fecha_vencimiento` DATE NULL,
    `fabricante` VARCHAR(150) NULL,
    `proveedor` VARCHAR(150) NULL,
    `recibido_en` DATETIME(3) NULL,
    `documento_soporte` VARCHAR(500) NULL,
    `observaciones` TEXT NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `inv_lotes_fecha_vencimiento_idx`(`fecha_vencimiento`),
    UNIQUE INDEX `inv_lotes_insumo_id_numero_lote_key`(`insumo_id`, `numero_lote`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inv_equipos` (
    `id` CHAR(36) NOT NULL,
    `insumo_id` CHAR(36) NOT NULL,
    `registro_sanitario_id` CHAR(36) NULL,
    `numero_serie` VARCHAR(100) NOT NULL,
    `marca` VARCHAR(100) NULL,
    `modelo` VARCHAR(100) NULL,
    `fecha_adquisicion` DATE NULL,
    `estado` VARCHAR(40) NOT NULL DEFAULT 'operativo',
    `fecha_ultimo_mantenimiento` DATE NULL,
    `fecha_proximo_mantenimiento` DATE NULL,
    `observaciones` TEXT NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizado_en` DATETIME(3) NOT NULL,

    UNIQUE INDEX `inv_equipos_numero_serie_key`(`numero_serie`),
    INDEX `inv_equipos_estado_fecha_proximo_mantenimiento_idx`(`estado`, `fecha_proximo_mantenimiento`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inv_existencias` (
    `id` CHAR(36) NOT NULL,
    `ubicacion_id` CHAR(36) NOT NULL,
    `insumo_id` CHAR(36) NOT NULL,
    `lote_id` CHAR(36) NULL,
    `equipo_id` CHAR(36) NULL,
    `clave_control` VARCHAR(120) NOT NULL,
    `cantidad` DECIMAL(12, 3) NOT NULL DEFAULT 0,
    `actualizada_en` DATETIME(3) NOT NULL,

    INDEX `inv_existencias_insumo_id_ubicacion_id_idx`(`insumo_id`, `ubicacion_id`),
    UNIQUE INDEX `inv_existencias_ubicacion_id_clave_control_key`(`ubicacion_id`, `clave_control`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inv_movimientos` (
    `id` CHAR(36) NOT NULL,
    `codigo` VARCHAR(50) NOT NULL,
    `tipo` VARCHAR(30) NOT NULL,
    `estado` VARCHAR(20) NOT NULL DEFAULT 'borrador',
    `origen_ubicacion_id` CHAR(36) NULL,
    `destino_ubicacion_id` CHAR(36) NULL,
    `asignacion_id` CHAR(36) NULL,
    `usuario_id` CHAR(36) NOT NULL,
    `motivo` VARCHAR(150) NULL,
    `observaciones` TEXT NULL,
    `documento_referencia` VARCHAR(150) NULL,
    `realizado_en` DATETIME(3) NOT NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizado_en` DATETIME(3) NOT NULL,

    UNIQUE INDEX `inv_movimientos_codigo_key`(`codigo`),
    INDEX `inv_movimientos_tipo_estado_realizado_en_idx`(`tipo`, `estado`, `realizado_en`),
    INDEX `inv_movimientos_asignacion_id_idx`(`asignacion_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inv_movimiento_detalles` (
    `id` CHAR(36) NOT NULL,
    `movimiento_id` CHAR(36) NOT NULL,
    `insumo_id` CHAR(36) NOT NULL,
    `lote_id` CHAR(36) NULL,
    `equipo_id` CHAR(36) NULL,
    `cantidad` DECIMAL(12, 3) NOT NULL,
    `observaciones` TEXT NULL,

    INDEX `inv_movimiento_detalles_movimiento_id_idx`(`movimiento_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inv_controles_almacenamiento` (
    `id` CHAR(36) NOT NULL,
    `ubicacion_id` CHAR(36) NOT NULL,
    `usuario_id` CHAR(36) NOT NULL,
    `temperatura` DECIMAL(6, 2) NULL,
    `humedad` DECIMAL(6, 2) NULL,
    `registrado_en` DATETIME(3) NOT NULL,
    `observaciones` TEXT NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `inv_controles_almacenamiento_ubicacion_id_registrado_en_idx`(`ubicacion_id`, `registrado_en`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inv_mantenimientos` (
    `id` CHAR(36) NOT NULL,
    `equipo_id` CHAR(36) NOT NULL,
    `tipo` VARCHAR(30) NOT NULL,
    `fecha_mantenimiento` DATE NOT NULL,
    `fecha_proximo` DATE NULL,
    `responsable` VARCHAR(150) NULL,
    `proveedor` VARCHAR(150) NULL,
    `documento_soporte` VARCHAR(500) NULL,
    `resultado` VARCHAR(50) NULL,
    `observaciones` TEXT NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `inv_mantenimientos_equipo_id_fecha_mantenimiento_idx`(`equipo_id`, `fecha_mantenimiento`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inv_perfiles_dotacion` (
    `id` CHAR(36) NOT NULL,
    `tipo_ambulancia_id` CHAR(36) NOT NULL,
    `codigo` VARCHAR(50) NOT NULL,
    `nombre` VARCHAR(150) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `descripcion` TEXT NULL,
    `vigente_desde` DATE NULL,
    `vigente_hasta` DATE NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizado_en` DATETIME(3) NOT NULL,

    UNIQUE INDEX `inv_perfiles_dotacion_tipo_ambulancia_id_codigo_version_key`(`tipo_ambulancia_id`, `codigo`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inv_perfil_dotacion_detalles` (
    `id` CHAR(36) NOT NULL,
    `perfil_dotacion_id` CHAR(36) NOT NULL,
    `insumo_id` CHAR(36) NOT NULL,
    `cantidad_requerida` DECIMAL(12, 3) NOT NULL,
    `cantidad_minima` DECIMAL(12, 3) NULL,
    `obligatorio` BOOLEAN NOT NULL DEFAULT true,
    `observaciones` TEXT NULL,

    UNIQUE INDEX `inv_perfil_dotacion_detalles_perfil_dotacion_id_insumo_id_key`(`perfil_dotacion_id`, `insumo_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inv_verificaciones` (
    `id` CHAR(36) NOT NULL,
    `ubicacion_id` CHAR(36) NOT NULL,
    `turno_id` CHAR(36) NULL,
    `responsable_id` CHAR(36) NOT NULL,
    `tipo` VARCHAR(30) NOT NULL,
    `estado` VARCHAR(30) NOT NULL DEFAULT 'borrador',
    `iniciada_en` DATETIME(3) NOT NULL,
    `finalizada_en` DATETIME(3) NULL,
    `observaciones` TEXT NULL,
    `creada_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizada_en` DATETIME(3) NOT NULL,

    INDEX `inv_verificaciones_ubicacion_id_iniciada_en_idx`(`ubicacion_id`, `iniciada_en`),
    INDEX `inv_verificaciones_responsable_id_iniciada_en_idx`(`responsable_id`, `iniciada_en`),
    INDEX `inv_verificaciones_estado_idx`(`estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inv_verificacion_detalles` (
    `id` CHAR(36) NOT NULL,
    `verificacion_id` CHAR(36) NOT NULL,
    `perfil_detalle_id` CHAR(36) NULL,
    `insumo_id` CHAR(36) NOT NULL,
    `lote_id` CHAR(36) NULL,
    `equipo_id` CHAR(36) NULL,
    `cantidad_esperada` DECIMAL(12, 3) NOT NULL DEFAULT 0,
    `cantidad_encontrada` DECIMAL(12, 3) NOT NULL DEFAULT 0,
    `estado` VARCHAR(30) NOT NULL,
    `observaciones` TEXT NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `inv_verificacion_detalles_verificacion_id_idx`(`verificacion_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `inv_registros_sanitarios` ADD CONSTRAINT `inv_registros_sanitarios_insumo_id_fkey` FOREIGN KEY (`insumo_id`) REFERENCES `inv_insumos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_bodegas` ADD CONSTRAINT `inv_bodegas_responsable_id_fkey` FOREIGN KEY (`responsable_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_ubicaciones` ADD CONSTRAINT `inv_ubicaciones_bodega_id_fkey` FOREIGN KEY (`bodega_id`) REFERENCES `inv_bodegas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `inv_ubicaciones` ADD CONSTRAINT `inv_ubicaciones_ambulancia_id_fkey` FOREIGN KEY (`ambulancia_id`) REFERENCES `ambulancias`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `inv_lotes` ADD CONSTRAINT `inv_lotes_insumo_id_fkey` FOREIGN KEY (`insumo_id`) REFERENCES `inv_insumos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_lotes` ADD CONSTRAINT `inv_lotes_registro_sanitario_id_fkey` FOREIGN KEY (`registro_sanitario_id`) REFERENCES `inv_registros_sanitarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_equipos` ADD CONSTRAINT `inv_equipos_insumo_id_fkey` FOREIGN KEY (`insumo_id`) REFERENCES `inv_insumos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_equipos` ADD CONSTRAINT `inv_equipos_registro_sanitario_id_fkey` FOREIGN KEY (`registro_sanitario_id`) REFERENCES `inv_registros_sanitarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_existencias` ADD CONSTRAINT `inv_existencias_ubicacion_id_fkey` FOREIGN KEY (`ubicacion_id`) REFERENCES `inv_ubicaciones`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_existencias` ADD CONSTRAINT `inv_existencias_insumo_id_fkey` FOREIGN KEY (`insumo_id`) REFERENCES `inv_insumos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_existencias` ADD CONSTRAINT `inv_existencias_lote_id_fkey` FOREIGN KEY (`lote_id`) REFERENCES `inv_lotes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_existencias` ADD CONSTRAINT `inv_existencias_equipo_id_fkey` FOREIGN KEY (`equipo_id`) REFERENCES `inv_equipos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_movimientos` ADD CONSTRAINT `inv_movimientos_origen_ubicacion_id_fkey` FOREIGN KEY (`origen_ubicacion_id`) REFERENCES `inv_ubicaciones`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_movimientos` ADD CONSTRAINT `inv_movimientos_destino_ubicacion_id_fkey` FOREIGN KEY (`destino_ubicacion_id`) REFERENCES `inv_ubicaciones`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_movimientos` ADD CONSTRAINT `inv_movimientos_asignacion_id_fkey` FOREIGN KEY (`asignacion_id`) REFERENCES `asignaciones_servicio`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_movimientos` ADD CONSTRAINT `inv_movimientos_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_movimiento_detalles` ADD CONSTRAINT `inv_movimiento_detalles_movimiento_id_fkey` FOREIGN KEY (`movimiento_id`) REFERENCES `inv_movimientos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_movimiento_detalles` ADD CONSTRAINT `inv_movimiento_detalles_insumo_id_fkey` FOREIGN KEY (`insumo_id`) REFERENCES `inv_insumos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_movimiento_detalles` ADD CONSTRAINT `inv_movimiento_detalles_lote_id_fkey` FOREIGN KEY (`lote_id`) REFERENCES `inv_lotes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_movimiento_detalles` ADD CONSTRAINT `inv_movimiento_detalles_equipo_id_fkey` FOREIGN KEY (`equipo_id`) REFERENCES `inv_equipos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_controles_almacenamiento` ADD CONSTRAINT `inv_controles_almacenamiento_ubicacion_id_fkey` FOREIGN KEY (`ubicacion_id`) REFERENCES `inv_ubicaciones`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_controles_almacenamiento` ADD CONSTRAINT `inv_controles_almacenamiento_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_mantenimientos` ADD CONSTRAINT `inv_mantenimientos_equipo_id_fkey` FOREIGN KEY (`equipo_id`) REFERENCES `inv_equipos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_perfiles_dotacion` ADD CONSTRAINT `inv_perfiles_dotacion_tipo_ambulancia_id_fkey` FOREIGN KEY (`tipo_ambulancia_id`) REFERENCES `tipos_ambulancia`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_perfil_dotacion_detalles` ADD CONSTRAINT `inv_perfil_dotacion_detalles_perfil_dotacion_id_fkey` FOREIGN KEY (`perfil_dotacion_id`) REFERENCES `inv_perfiles_dotacion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_perfil_dotacion_detalles` ADD CONSTRAINT `inv_perfil_dotacion_detalles_insumo_id_fkey` FOREIGN KEY (`insumo_id`) REFERENCES `inv_insumos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_verificaciones` ADD CONSTRAINT `inv_verificaciones_ubicacion_id_fkey` FOREIGN KEY (`ubicacion_id`) REFERENCES `inv_ubicaciones`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_verificaciones` ADD CONSTRAINT `inv_verificaciones_turno_id_fkey` FOREIGN KEY (`turno_id`) REFERENCES `turnos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_verificaciones` ADD CONSTRAINT `inv_verificaciones_responsable_id_fkey` FOREIGN KEY (`responsable_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_verificacion_detalles` ADD CONSTRAINT `inv_verificacion_detalles_verificacion_id_fkey` FOREIGN KEY (`verificacion_id`) REFERENCES `inv_verificaciones`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_verificacion_detalles` ADD CONSTRAINT `inv_verificacion_detalles_perfil_detalle_id_fkey` FOREIGN KEY (`perfil_detalle_id`) REFERENCES `inv_perfil_dotacion_detalles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_verificacion_detalles` ADD CONSTRAINT `inv_verificacion_detalles_insumo_id_fkey` FOREIGN KEY (`insumo_id`) REFERENCES `inv_insumos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_verificacion_detalles` ADD CONSTRAINT `inv_verificacion_detalles_lote_id_fkey` FOREIGN KEY (`lote_id`) REFERENCES `inv_lotes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inv_verificacion_detalles` ADD CONSTRAINT `inv_verificacion_detalles_equipo_id_fkey` FOREIGN KEY (`equipo_id`) REFERENCES `inv_equipos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Restricciones CHECK (Prisma no las modela; agregadas a mano).
-- Las FK de inv_ubicaciones usan ON UPDATE RESTRICT: MySQL no admite un CHECK
-- sobre columnas con acciones referenciales (error 3823) y los UUID no cambian.
-- ---------------------------------------------------------------------------

-- Una ubicación es una bodega o una ambulancia, nunca las dos.
ALTER TABLE `inv_ubicaciones` ADD CONSTRAINT `inv_ubicaciones_tipo_check` CHECK (
    (`tipo` = 'bodega' AND `bodega_id` IS NOT NULL AND `ambulancia_id` IS NULL)
    OR (`tipo` = 'ambulancia' AND `ambulancia_id` IS NOT NULL AND `bodega_id` IS NULL)
);

-- Las existencias nunca quedan negativas.
ALTER TABLE `inv_existencias` ADD CONSTRAINT `inv_existencias_cantidad_check` CHECK (`cantidad` >= 0);

-- Cada línea de un movimiento mueve una cantidad positiva.
ALTER TABLE `inv_movimiento_detalles` ADD CONSTRAINT `inv_movimiento_detalles_cantidad_check` CHECK (`cantidad` > 0);

-- La dotación pide algo, y el mínimo no supera lo requerido.
ALTER TABLE `inv_perfil_dotacion_detalles` ADD CONSTRAINT `inv_perfil_dotacion_detalles_cantidades_check` CHECK (
    `cantidad_requerida` > 0
    AND (`cantidad_minima` IS NULL OR (`cantidad_minima` >= 0 AND `cantidad_minima` <= `cantidad_requerida`))
);

-- Lo contado y lo esperado no son negativos.
ALTER TABLE `inv_verificacion_detalles` ADD CONSTRAINT `inv_verificacion_detalles_cantidades_check` CHECK (
    `cantidad_esperada` >= 0 AND `cantidad_encontrada` >= 0
);
