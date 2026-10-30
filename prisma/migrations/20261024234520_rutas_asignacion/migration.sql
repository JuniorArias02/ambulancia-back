-- CreateTable
CREATE TABLE `rutas_asignacion` (
    `id` CHAR(36) NOT NULL,
    `asignacion_id` CHAR(36) NOT NULL,
    `tramo` VARCHAR(30) NOT NULL,
    `motivo` VARCHAR(30) NOT NULL,
    `origen_latitud` DECIMAL(10, 7) NOT NULL,
    `origen_longitud` DECIMAL(10, 7) NOT NULL,
    `destino_latitud` DECIMAL(10, 7) NOT NULL,
    `destino_longitud` DECIMAL(10, 7) NOT NULL,
    `geometria` JSON NOT NULL,
    `distancia_metros` INTEGER NOT NULL,
    `duracion_segundos` INTEGER NOT NULL,
    `proveedor` VARCHAR(40) NOT NULL,
    `calculada_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `rutas_asignacion_asignacion_id_calculada_en_idx`(`asignacion_id`, `calculada_en`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `rutas_asignacion` ADD CONSTRAINT `rutas_asignacion_asignacion_id_fkey` FOREIGN KEY (`asignacion_id`) REFERENCES `asignaciones_servicio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
