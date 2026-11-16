-- CreateTable
CREATE TABLE `firmas_historia` (
    `id` CHAR(36) NOT NULL,
    `historia_clinica_id` CHAR(36) NOT NULL,
    `rol_firmante` VARCHAR(20) NOT NULL,
    `proposito` VARCHAR(30) NOT NULL,
    `nombre_firmante` VARCHAR(150) NULL,
    `tipo_documento` VARCHAR(30) NULL,
    `numero_documento` VARCHAR(40) NULL,
    `parentesco` VARCHAR(30) NULL,
    `cargo` VARCHAR(100) NULL,
    `clave_almacenamiento` VARCHAR(100) NULL,
    `tipo_mime` VARCHAR(50) NULL,
    `tamano_bytes` INTEGER NULL,
    `ancho_px` SMALLINT NULL,
    `alto_px` SMALLINT NULL,
    `huella_sha256` CHAR(64) NULL,
    `motivo_sin_firma` VARCHAR(30) NULL,
    `detalle_motivo` VARCHAR(255) NULL,
    `texto_version` VARCHAR(10) NOT NULL,
    `firmada_en` DATETIME(3) NOT NULL,
    `registrada_por_id` CHAR(36) NOT NULL,
    `creada_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `firmas_historia_clave_almacenamiento_key`(`clave_almacenamiento`),
    UNIQUE INDEX `firmas_historia_historia_clinica_id_proposito_rol_firmante_key`(`historia_clinica_id`, `proposito`, `rol_firmante`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `firmas_historia` ADD CONSTRAINT `firmas_historia_historia_clinica_id_fkey` FOREIGN KEY (`historia_clinica_id`) REFERENCES `historias_clinicas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `firmas_historia` ADD CONSTRAINT `firmas_historia_registrada_por_id_fkey` FOREIGN KEY (`registrada_por_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Manual: Prisma no genera CHECK. Las mismas reglas de firma_historia.ts.
-- historia_clinica_id y registrada_por_id tienen clave foránea y no pueden
-- ir en un CHECK (MySQL 3823).
ALTER TABLE `firmas_historia`
    ADD CONSTRAINT `firmas_historia_rol_check`
        CHECK (`rol_firmante` IN ('paciente', 'acudiente', 'testigo', 'receptor')),
    ADD CONSTRAINT `firmas_historia_proposito_check`
        CHECK (`proposito` IN ('comprobante_atencion', 'disentimiento', 'entrega')),
    -- Qué firma cada rol: el testigo solo el disentimiento; el receptor solo la entrega.
    ADD CONSTRAINT `firmas_historia_rol_proposito_check`
        CHECK ((`rol_firmante` = 'receptor') = (`proposito` = 'entrega')
            AND (`rol_firmante` <> 'testigo' OR `proposito` = 'disentimiento')),
    -- O tiene imagen completa, o tiene motivo (y entonces es del paciente).
    ADD CONSTRAINT `firmas_historia_imagen_o_motivo_check`
        CHECK ((`clave_almacenamiento` IS NOT NULL AND `tipo_mime` = 'image/png'
                AND `tamano_bytes` BETWEEN 1 AND 204800
                AND `ancho_px` > 0 AND `alto_px` > 0
                AND `huella_sha256` REGEXP '^[0-9a-f]{64}$'
                AND `motivo_sin_firma` IS NULL)
            OR (`clave_almacenamiento` IS NULL AND `tipo_mime` IS NULL
                AND `tamano_bytes` IS NULL AND `huella_sha256` IS NULL
                AND `rol_firmante` = 'paciente'
                AND `motivo_sin_firma` IN ('inconsciente_sin_acudiente', 'fallecido', 'se_nego', 'otro'))),
    ADD CONSTRAINT `firmas_historia_detalle_motivo_check`
        CHECK (`detalle_motivo` IS NULL OR `motivo_sin_firma` IS NOT NULL),
    -- Datos obligatorios del firmante según su rol.
    ADD CONSTRAINT `firmas_historia_datos_firmante_check`
        CHECK ((`rol_firmante` NOT IN ('acudiente', 'testigo')
                OR (`nombre_firmante` IS NOT NULL AND `numero_documento` IS NOT NULL
                    AND `tipo_documento` IN ('CC', 'CE', 'PA', 'PEP', 'PPT')))
            AND (`rol_firmante` <> 'acudiente' OR `parentesco` IS NOT NULL)
            AND (`rol_firmante` <> 'receptor' OR (`nombre_firmante` IS NOT NULL AND `cargo` IS NOT NULL)));
