-- CreateIndex
CREATE INDEX `emergencias_recibida_en_idx` ON `emergencias`(`recibida_en`);

-- CreateIndex
CREATE INDEX `historias_clinicas_abierta_en_idx` ON `historias_clinicas`(`abierta_en`);

-- CreateIndex
CREATE INDEX `historias_clinicas_hora_evento_idx` ON `historias_clinicas`(`hora_evento`);

-- CreateIndex
CREATE INDEX `historias_clinicas_cerrada_en_idx` ON `historias_clinicas`(`cerrada_en`);

-- CreateIndex
CREATE INDEX `historias_clinicas_apellidos_nombres_idx` ON `historias_clinicas`(`apellidos`, `nombres`);
