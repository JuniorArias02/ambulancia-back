-- CreateTable
CREATE TABLE `valoraciones_downton` (
    `id` CHAR(36) NOT NULL,
    `historia_clinica_id` CHAR(36) NOT NULL,
    `evaluada_en` DATETIME(3) NOT NULL,
    `caidas_previas` BOOLEAN NOT NULL DEFAULT false,
    `med_tranquilizantes_sedantes` BOOLEAN NOT NULL DEFAULT false,
    `med_diureticos` BOOLEAN NOT NULL DEFAULT false,
    `med_hipotensores` BOOLEAN NOT NULL DEFAULT false,
    `med_antiparkinsonianos` BOOLEAN NOT NULL DEFAULT false,
    `med_antidepresivos` BOOLEAN NOT NULL DEFAULT false,
    `med_otros` BOOLEAN NOT NULL DEFAULT false,
    `deficit_visual` BOOLEAN NOT NULL DEFAULT false,
    `deficit_auditivo` BOOLEAN NOT NULL DEFAULT false,
    `deficit_extremidades` BOOLEAN NOT NULL DEFAULT false,
    `estado_mental` VARCHAR(20) NOT NULL,
    `deambulacion` VARCHAR(30) NOT NULL,
    `puntaje_total` TINYINT NOT NULL,
    `nivel_riesgo` VARCHAR(10) NOT NULL,
    `observacion` VARCHAR(255) NULL,
    `origen` VARCHAR(20) NOT NULL DEFAULT 'manual',
    `segmento_audio_id` CHAR(36) NULL,
    `confirmado` BOOLEAN NOT NULL DEFAULT false,
    `registrado_por_id` CHAR(36) NOT NULL,
    `creada_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `valoraciones_downton_historia_clinica_id_evaluada_en_idx`(`historia_clinica_id`, `evaluada_en`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `valoraciones_downton` ADD CONSTRAINT `valoraciones_downton_historia_clinica_id_fkey` FOREIGN KEY (`historia_clinica_id`) REFERENCES `historias_clinicas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `valoraciones_downton` ADD CONSTRAINT `valoraciones_downton_segmento_audio_id_fkey` FOREIGN KEY (`segmento_audio_id`) REFERENCES `segmentos_audio`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `valoraciones_downton` ADD CONSTRAINT `valoraciones_downton_registrado_por_id_fkey` FOREIGN KEY (`registrado_por_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Manual: Prisma no genera CHECK. Las mismas reglas del dominio
-- (catalogos_clinicos.ts y valoracion_downton.entity.ts), para que nada que
-- entre por fuera de la API deje una valoración incoherente.
ALTER TABLE `valoraciones_downton`
    ADD CONSTRAINT `valoraciones_downton_estado_mental_check`
        CHECK (`estado_mental` IN ('orientado', 'confuso')),
    ADD CONSTRAINT `valoraciones_downton_deambulacion_check`
        CHECK (`deambulacion` IN ('normal', 'segura_con_ayuda', 'insegura', 'imposible')),
    ADD CONSTRAINT `valoraciones_downton_origen_check`
        CHECK (`origen` IN ('manual', 'voz')),
    ADD CONSTRAINT `valoraciones_downton_puntaje_check`
        CHECK (`puntaje_total` BETWEEN 0 AND 12),
    ADD CONSTRAINT `valoraciones_downton_nivel_riesgo_check`
        CHECK ((`nivel_riesgo` = 'alto' AND `puntaje_total` >= 3)
            OR (`nivel_riesgo` = 'bajo' AND `puntaje_total` < 3));
