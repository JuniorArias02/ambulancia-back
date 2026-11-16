-- AlterTable
ALTER TABLE `historias_clinicas` ADD COLUMN `regimen_afiliacion` VARCHAR(30) NULL;

-- Manual: Prisma no genera CHECK. Los mismos valores de REGIMENES_AFILIACION
-- (catalogos_clinicos.ts).
ALTER TABLE `historias_clinicas`
    ADD CONSTRAINT `historias_clinicas_regimen_afiliacion_check`
        CHECK (`regimen_afiliacion` IS NULL
            OR `regimen_afiliacion` IN ('contributivo', 'subsidiado', 'especial_excepcion', 'no_afiliado'));
