-- AlterTable
ALTER TABLE `emergencias` ADD COLUMN `modalidad` VARCHAR(40) NOT NULL DEFAULT 'emergencia';

-- Manual: Prisma no genera CHECK. Los mismos valores de MODALIDADES_SERVICIO
-- (emergencies/domain/entities/emergencia.entity.ts). Las emergencias que ya
-- existían quedan como 'emergencia' (valor por defecto).
ALTER TABLE `emergencias`
    ADD CONSTRAINT `emergencias_modalidad_check`
        CHECK (`modalidad` IN ('emergencia', 'accidente_transito', 'traslado_programado', 'traslado_interhospitalario', 'atencion_en_sitio'));
