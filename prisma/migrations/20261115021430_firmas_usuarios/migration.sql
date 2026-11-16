-- AlterTable
ALTER TABLE `historias_clinicas` ADD COLUMN `firma_cierre_id` CHAR(36) NULL;

-- CreateTable
CREATE TABLE `firmas_usuarios` (
    `id` CHAR(36) NOT NULL,
    `usuario_id` CHAR(36) NOT NULL,
    `clave_almacenamiento` VARCHAR(100) NOT NULL,
    `tipo_mime` VARCHAR(50) NOT NULL,
    `tamano_bytes` INTEGER NOT NULL,
    `ancho_px` SMALLINT NOT NULL,
    `alto_px` SMALLINT NOT NULL,
    `huella_sha256` CHAR(64) NOT NULL,
    `vigente` BOOLEAN NOT NULL DEFAULT true,
    `registrada_en` DATETIME(3) NOT NULL,
    `reemplazada_en` DATETIME(3) NULL,
    `desactivada_en` DATETIME(3) NULL,
    `desactivada_por_id` CHAR(36) NULL,
    `motivo_desactivacion` VARCHAR(255) NULL,

    UNIQUE INDEX `firmas_usuarios_clave_almacenamiento_key`(`clave_almacenamiento`),
    INDEX `firmas_usuarios_usuario_id_vigente_idx`(`usuario_id`, `vigente`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `historias_clinicas` ADD CONSTRAINT `historias_clinicas_firma_cierre_id_fkey` FOREIGN KEY (`firma_cierre_id`) REFERENCES `firmas_usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `firmas_usuarios` ADD CONSTRAINT `firmas_usuarios_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `firmas_usuarios` ADD CONSTRAINT `firmas_usuarios_desactivada_por_id_fkey` FOREIGN KEY (`desactivada_por_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Manual: Prisma no genera CHECK. Las mismas reglas de firma_usuario.entity.ts
-- e imagen_firma.ts. Las columnas con clave foránea no pueden ir en un CHECK
-- (MySQL 3823), por eso el estado se valida con las fechas.
ALTER TABLE `firmas_usuarios`
    ADD CONSTRAINT `firmas_usuarios_tipo_mime_check`
        CHECK (`tipo_mime` = 'image/png'),
    ADD CONSTRAINT `firmas_usuarios_huella_check`
        CHECK (`huella_sha256` REGEXP '^[0-9a-f]{64}$'),
    ADD CONSTRAINT `firmas_usuarios_tamano_check`
        CHECK (`tamano_bytes` BETWEEN 1 AND 204800 AND `ancho_px` > 0 AND `alto_px` > 0),
    ADD CONSTRAINT `firmas_usuarios_estado_check`
        CHECK ((`vigente` = 1 AND `reemplazada_en` IS NULL AND `desactivada_en` IS NULL)
            OR (`vigente` = 0 AND (`reemplazada_en` IS NOT NULL OR `desactivada_en` IS NOT NULL))),
    ADD CONSTRAINT `firmas_usuarios_motivo_check`
        CHECK ((`desactivada_en` IS NULL) = (`motivo_desactivacion` IS NULL));
