-- Revisión de las novedades de una verificación por la central (2026-11-13).
-- Solo agrega columnas opcionales: no modifica ni borra datos existentes.

-- AlterTable
ALTER TABLE `inv_verificaciones` ADD COLUMN `resolucion` TEXT NULL,
    ADD COLUMN `revisada_en` DATETIME(3) NULL,
    ADD COLUMN `revisada_por_id` CHAR(36) NULL;

-- CreateIndex
CREATE INDEX `inv_verificaciones_estado_revisada_en_idx` ON `inv_verificaciones`(`estado`, `revisada_en`);

-- AddForeignKey
ALTER TABLE `inv_verificaciones` ADD CONSTRAINT `inv_verificaciones_revisada_por_id_fkey` FOREIGN KEY (`revisada_por_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Solo se revisa una verificación finalizada con novedades. (revisada_por_id no
-- puede ir en el CHECK porque su FK tiene acción referencial: error 3823 de MySQL.)
ALTER TABLE `inv_verificaciones` ADD CONSTRAINT `inv_verificaciones_revision_check` CHECK (
    `revisada_en` IS NULL OR `estado` = 'con_novedades'
);
