-- CreateTable
CREATE TABLE `listas_chequeo` (
    `id` CHAR(36) NOT NULL,
    `nombre` VARCHAR(150) NOT NULL,
    `descripcion` VARCHAR(255) NULL,
    `activa` BOOLEAN NOT NULL DEFAULT true,
    `creada_por_id` CHAR(36) NOT NULL,
    `creada_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizada_en` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `estados_lista_chequeo` (
    `id` CHAR(36) NOT NULL,
    `lista_chequeo_id` CHAR(36) NOT NULL,
    `nombre` VARCHAR(60) NOT NULL,
    `valor` INTEGER NULL,
    `orden` INTEGER NOT NULL DEFAULT 0,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `items_lista_chequeo` (
    `id` CHAR(36) NOT NULL,
    `lista_chequeo_id` CHAR(36) NOT NULL,
    `pregunta` VARCHAR(500) NOT NULL,
    `orden` INTEGER NOT NULL DEFAULT 0,
    `obligatorio` BOOLEAN NOT NULL DEFAULT true,
    `permite_observacion` BOOLEAN NOT NULL DEFAULT true,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chequeos_diarios` (
    `id` CHAR(36) NOT NULL,
    `lista_chequeo_id` CHAR(36) NOT NULL,
    `conductor_id` CHAR(36) NOT NULL,
    `ambulancia_id` CHAR(36) NOT NULL,
    `fecha` DATE NOT NULL,
    `iniciado_en` DATETIME(3) NULL,
    `finalizado_en` DATETIME(3) NULL,
    `estado` VARCHAR(30) NOT NULL DEFAULT 'borrador',

    UNIQUE INDEX `uk_chequeo_diario`(`lista_chequeo_id`, `conductor_id`, `ambulancia_id`, `fecha`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `respuestas_chequeo` (
    `id` CHAR(36) NOT NULL,
    `chequeo_id` CHAR(36) NOT NULL,
    `item_id` CHAR(36) NOT NULL,
    `estado_id` CHAR(36) NOT NULL,
    `tiene_observacion` BOOLEAN NOT NULL DEFAULT false,
    `observacion` VARCHAR(1000) NULL,
    `respondido_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uk_respuesta_item`(`chequeo_id`, `item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `listas_chequeo` ADD CONSTRAINT `listas_chequeo_creada_por_id_fkey` FOREIGN KEY (`creada_por_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `estados_lista_chequeo` ADD CONSTRAINT `estados_lista_chequeo_lista_chequeo_id_fkey` FOREIGN KEY (`lista_chequeo_id`) REFERENCES `listas_chequeo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `items_lista_chequeo` ADD CONSTRAINT `items_lista_chequeo_lista_chequeo_id_fkey` FOREIGN KEY (`lista_chequeo_id`) REFERENCES `listas_chequeo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chequeos_diarios` ADD CONSTRAINT `chequeos_diarios_lista_chequeo_id_fkey` FOREIGN KEY (`lista_chequeo_id`) REFERENCES `listas_chequeo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chequeos_diarios` ADD CONSTRAINT `chequeos_diarios_conductor_id_fkey` FOREIGN KEY (`conductor_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chequeos_diarios` ADD CONSTRAINT `chequeos_diarios_ambulancia_id_fkey` FOREIGN KEY (`ambulancia_id`) REFERENCES `ambulancias`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `respuestas_chequeo` ADD CONSTRAINT `respuestas_chequeo_chequeo_id_fkey` FOREIGN KEY (`chequeo_id`) REFERENCES `chequeos_diarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `respuestas_chequeo` ADD CONSTRAINT `respuestas_chequeo_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items_lista_chequeo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `respuestas_chequeo` ADD CONSTRAINT `respuestas_chequeo_estado_id_fkey` FOREIGN KEY (`estado_id`) REFERENCES `estados_lista_chequeo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
