-- AlterTable
ALTER TABLE `direcciones_geocodificadas` MODIFY `proveedor_resultado_id` VARCHAR(512) NULL;

-- CreateTable
CREATE TABLE `geocodificaciones_inversas` (
    `id` CHAR(36) NOT NULL,
    `clave_punto` VARCHAR(40) NOT NULL,
    `latitud_solicitada` DECIMAL(10, 7) NOT NULL,
    `longitud_solicitada` DECIMAL(10, 7) NOT NULL,
    `direccion` VARCHAR(255) NULL,
    `linea_direccion` VARCHAR(255) NULL,
    `calle` VARCHAR(150) NULL,
    `numero` VARCHAR(50) NULL,
    `barrio` VARCHAR(150) NULL,
    `ciudad` VARCHAR(100) NULL,
    `departamento` VARCHAR(100) NULL,
    `codigo_postal` VARCHAR(20) NULL,
    `pais` VARCHAR(2) NULL,
    `latitud_direccion` DECIMAL(10, 7) NULL,
    `longitud_direccion` DECIMAL(10, 7) NULL,
    `distancia_metros` DECIMAL(9, 1) NULL,
    `precision` VARCHAR(20) NULL,
    `proveedor` VARCHAR(40) NOT NULL,
    `proveedor_resultado_id` VARCHAR(512) NULL,
    `estado` VARCHAR(30) NOT NULL,
    `creada_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizada_en` DATETIME(3) NOT NULL,

    UNIQUE INDEX `geocodificaciones_inversas_clave_punto_key`(`clave_punto`),
    INDEX `geocodificaciones_inversas_estado_actualizada_en_idx`(`estado`, `actualizada_en`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
