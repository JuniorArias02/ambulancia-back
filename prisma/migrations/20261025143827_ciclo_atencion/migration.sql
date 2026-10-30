-- AlterTable
ALTER TABLE `asignaciones_servicio` ADD COLUMN `atencion_inicio_en` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `eventos_asignacion` (
    `id` CHAR(36) NOT NULL,
    `asignacion_id` CHAR(36) NOT NULL,
    `estado_anterior` VARCHAR(40) NULL,
    `estado_nuevo` VARCHAR(40) NOT NULL,
    `usuario_id` CHAR(36) NULL,
    `rol_responsable` VARCHAR(30) NULL,
    `ocurrido_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `latitud` DECIMAL(10, 7) NULL,
    `longitud` DECIMAL(10, 7) NULL,
    `precision_metros` DECIMAL(7, 1) NULL,
    `distancia_escena_metros` DECIMAL(9, 1) NULL,
    `fuera_de_radio` BOOLEAN NOT NULL DEFAULT false,
    `observacion` VARCHAR(255) NULL,

    INDEX `eventos_asignacion_asignacion_id_ocurrido_en_idx`(`asignacion_id`, `ocurrido_en`),
    UNIQUE INDEX `eventos_asignacion_asignacion_id_estado_nuevo_key`(`asignacion_id`, `estado_nuevo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `eventos_asignacion` ADD CONSTRAINT `eventos_asignacion_asignacion_id_fkey` FOREIGN KEY (`asignacion_id`) REFERENCES `asignaciones_servicio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `eventos_asignacion` ADD CONSTRAINT `eventos_asignacion_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
