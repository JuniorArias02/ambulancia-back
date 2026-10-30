-- CreateTable
CREATE TABLE `direcciones_geocodificadas` (
    `id` CHAR(36) NOT NULL,
    `direccion_original` VARCHAR(255) NOT NULL,
    `direccion_normalizada` VARCHAR(320) NOT NULL,
    `ciudad` VARCHAR(100) NULL,
    `direccion_formateada` VARCHAR(255) NULL,
    `latitud` DECIMAL(10, 7) NULL,
    `longitud` DECIMAL(10, 7) NULL,
    `proveedor` VARCHAR(40) NOT NULL,
    `proveedor_resultado_id` VARCHAR(255) NULL,
    `confianza` DECIMAL(4, 3) NULL,
    `estado` VARCHAR(30) NOT NULL,
    `creada_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizada_en` DATETIME(3) NOT NULL,

    UNIQUE INDEX `direcciones_geocodificadas_direccion_normalizada_key`(`direccion_normalizada`),
    INDEX `direcciones_geocodificadas_estado_actualizada_en_idx`(`estado`, `actualizada_en`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
