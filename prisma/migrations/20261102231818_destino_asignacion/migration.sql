-- AlterTable
ALTER TABLE `asignaciones_servicio` ADD COLUMN `destino_actualizado_en` DATETIME(3) NULL,
    ADD COLUMN `destino_actualizado_por_id` CHAR(36) NULL,
    ADD COLUMN `institucion_destino_id` CHAR(36) NULL;

-- AddForeignKey
ALTER TABLE `asignaciones_servicio` ADD CONSTRAINT `asignaciones_servicio_institucion_destino_id_fkey` FOREIGN KEY (`institucion_destino_id`) REFERENCES `instituciones_salud`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asignaciones_servicio` ADD CONSTRAINT `asignaciones_servicio_destino_actualizado_por_id_fkey` FOREIGN KEY (`destino_actualizado_por_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
