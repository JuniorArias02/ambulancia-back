-- AlterTable
ALTER TABLE `emergencias` ADD COLUMN `informante_usuario_id` CHAR(36) NULL,
    ADD COLUMN `origen_ubicacion` VARCHAR(20) NULL;

-- AlterTable
ALTER TABLE `usuarios` ADD COLUMN `fecha_nacimiento` DATE NULL;

-- CreateTable
CREATE TABLE `verificaciones_identidad` (
    `id` CHAR(36) NOT NULL,
    `usuario_id` CHAR(36) NOT NULL,
    `estado` VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    `motivo` VARCHAR(500) NULL,
    `enviada_en` DATETIME(3) NOT NULL,
    `revisada_por_id` CHAR(36) NULL,
    `revisada_en` DATETIME(3) NULL,

    UNIQUE INDEX `verificaciones_identidad_usuario_id_key`(`usuario_id`),
    INDEX `verificaciones_identidad_estado_enviada_en_idx`(`estado`, `enviada_en`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documentos_identidad` (
    `id` CHAR(36) NOT NULL,
    `verificacion_id` CHAR(36) NOT NULL,
    `lado` VARCHAR(20) NOT NULL,
    `clave_almacenamiento` VARCHAR(100) NOT NULL,
    `tipo_mime` VARCHAR(50) NOT NULL,
    `tamano_bytes` INTEGER NOT NULL,
    `huella_sha256` CHAR(64) NOT NULL,
    `vigente` BOOLEAN NOT NULL DEFAULT true,
    `cargado_en` DATETIME(3) NOT NULL,
    `reemplazado_en` DATETIME(3) NULL,

    UNIQUE INDEX `documentos_identidad_clave_almacenamiento_key`(`clave_almacenamiento`),
    INDEX `documentos_identidad_verificacion_id_vigente_idx`(`verificacion_id`, `vigente`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `historial_verificaciones` (
    `id` CHAR(36) NOT NULL,
    `verificacion_id` CHAR(36) NOT NULL,
    `estado_anterior` VARCHAR(30) NULL,
    `estado_nuevo` VARCHAR(30) NOT NULL,
    `motivo` VARCHAR(500) NULL,
    `observaciones` TEXT NULL,
    `responsable_id` CHAR(36) NOT NULL,
    `ocurrido_en` DATETIME(3) NOT NULL,

    INDEX `historial_verificaciones_verificacion_id_ocurrido_en_idx`(`verificacion_id`, `ocurrido_en`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `emergencias_informante_usuario_id_recibida_en_idx` ON `emergencias`(`informante_usuario_id`, `recibida_en`);

-- AddForeignKey
ALTER TABLE `emergencias` ADD CONSTRAINT `emergencias_informante_usuario_id_fkey` FOREIGN KEY (`informante_usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `verificaciones_identidad` ADD CONSTRAINT `verificaciones_identidad_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `verificaciones_identidad` ADD CONSTRAINT `verificaciones_identidad_revisada_por_id_fkey` FOREIGN KEY (`revisada_por_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentos_identidad` ADD CONSTRAINT `documentos_identidad_verificacion_id_fkey` FOREIGN KEY (`verificacion_id`) REFERENCES `verificaciones_identidad`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historial_verificaciones` ADD CONSTRAINT `historial_verificaciones_verificacion_id_fkey` FOREIGN KEY (`verificacion_id`) REFERENCES `verificaciones_identidad`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historial_verificaciones` ADD CONSTRAINT `historial_verificaciones_responsable_id_fkey` FOREIGN KEY (`responsable_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Rol de los ciudadanos que reportan emergencias desde la app.
-- El seed también lo sincroniza; aquí se crea para los entornos donde no se ejecuta.
INSERT INTO `roles` (`id`, `nombre`, `descripcion`)
SELECT UUID(), 'ciudadano', 'Reporta emergencias desde la app una vez verificada su identidad'
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `nombre` = 'ciudadano');
