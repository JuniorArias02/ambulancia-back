-- AlterTable
ALTER TABLE `historias_clinicas` ADD COLUMN `paciente_id` CHAR(36) NULL;

-- CreateTable
CREATE TABLE `pacientes` (
    `id` CHAR(36) NOT NULL,
    `tipo_documento` VARCHAR(30) NOT NULL,
    `numero_documento` VARCHAR(40) NOT NULL,
    `nombres` VARCHAR(150) NULL,
    `apellidos` VARCHAR(150) NULL,
    `sexo` VARCHAR(20) NULL,
    `fecha_nacimiento` DATE NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizado_en` DATETIME(3) NOT NULL,

    INDEX `pacientes_apellidos_nombres_idx`(`apellidos`, `nombres`),
    UNIQUE INDEX `pacientes_tipo_documento_numero_documento_key`(`tipo_documento`, `numero_documento`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `historias_clinicas` ADD CONSTRAINT `historias_clinicas_paciente_id_fkey` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Manual: Prisma no genera CHECK. AS y MS ("adulto/menor sin identificación")
-- no identifican a una persona: esas historias no se enlazan.
ALTER TABLE `pacientes`
    ADD CONSTRAINT `pacientes_tipo_documento_check`
        CHECK (`tipo_documento` IN ('CC', 'TI', 'RC', 'CE', 'PA', 'PEP', 'PPT')),
    ADD CONSTRAINT `pacientes_numero_documento_check`
        CHECK (CHAR_LENGTH(`numero_documento`) > 0),
    ADD CONSTRAINT `pacientes_sexo_check`
        CHECK (`sexo` IS NULL OR `sexo` IN ('masculino', 'femenino', 'indeterminado'));

-- Llenado inicial: un paciente por documento, con los datos de su atención
-- más reciente (INSERT IGNORE conserva la primera fila de cada documento y
-- el SELECT viene ordenado de la más reciente a la más antigua).
INSERT IGNORE INTO `pacientes`
    (`id`, `tipo_documento`, `numero_documento`, `nombres`, `apellidos`, `sexo`, `fecha_nacimiento`, `creado_en`, `actualizado_en`)
SELECT UUID(), h.`tipo_documento`, h.`numero_documento`, h.`nombres`, h.`apellidos`,
       CASE WHEN h.`sexo` IN ('masculino', 'femenino', 'indeterminado') THEN h.`sexo` END,
       h.`fecha_nacimiento`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `historias_clinicas` h
WHERE h.`tipo_documento` IN ('CC', 'TI', 'RC', 'CE', 'PA', 'PEP', 'PPT')
  AND h.`numero_documento` IS NOT NULL AND h.`numero_documento` <> ''
ORDER BY h.`abierta_en` DESC;

UPDATE `historias_clinicas` h
JOIN `pacientes` p
  ON p.`tipo_documento` = h.`tipo_documento` AND p.`numero_documento` = h.`numero_documento`
SET h.`paciente_id` = p.`id`;
