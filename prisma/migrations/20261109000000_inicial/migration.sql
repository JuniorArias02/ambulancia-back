-- CreateTable
CREATE TABLE `roles` (
    `id` CHAR(36) NOT NULL,
    `nombre` VARCHAR(60) NOT NULL,
    `descripcion` VARCHAR(255) NULL,

    UNIQUE INDEX `roles_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuarios` (
    `id` CHAR(36) NOT NULL,
    `rol_id` CHAR(36) NOT NULL,
    `nombres` VARCHAR(100) NOT NULL,
    `apellidos` VARCHAR(100) NOT NULL,
    `tipo_documento` VARCHAR(30) NULL,
    `numero_documento` VARCHAR(40) NULL,
    `correo` VARCHAR(150) NOT NULL,
    `telefono` VARCHAR(30) NULL,
    `registro_profesional` VARCHAR(60) NULL,
    `fecha_nacimiento` DATE NULL,
    `contrasena_hash` VARCHAR(255) NOT NULL,
    `estado` VARCHAR(30) NOT NULL DEFAULT 'activo',
    `ultimo_acceso` DATETIME(3) NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `usuarios_numero_documento_key`(`numero_documento`),
    UNIQUE INDEX `usuarios_correo_key`(`correo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sesiones` (
    `id` CHAR(36) NOT NULL,
    `usuario_id` CHAR(36) NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL,
    `expira_en` DATETIME(3) NOT NULL,
    `revocada_en` DATETIME(3) NULL,
    `creada_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sesiones_usuario_id_idx`(`usuario_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auditoria_eventos` (
    `id` CHAR(36) NOT NULL,
    `usuario_id` CHAR(36) NULL,
    `entidad` VARCHAR(100) NOT NULL,
    `entidad_id` CHAR(36) NOT NULL,
    `accion` VARCHAR(60) NOT NULL,
    `detalle` JSON NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `auditoria_eventos_entidad_entidad_id_idx`(`entidad`, `entidad_id`),
    INDEX `auditoria_eventos_usuario_id_creado_en_idx`(`usuario_id`, `creado_en`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tipos_ambulancia` (
    `id` CHAR(36) NOT NULL,
    `nombre` VARCHAR(80) NOT NULL,
    `descripcion` VARCHAR(255) NULL,

    UNIQUE INDEX `tipos_ambulancia_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ambulancias` (
    `id` CHAR(36) NOT NULL,
    `codigo` VARCHAR(30) NOT NULL,
    `placa` VARCHAR(20) NOT NULL,
    `tipo_ambulancia_id` CHAR(36) NOT NULL,
    `estado_operativo` VARCHAR(40) NOT NULL DEFAULT 'fuera_servicio',
    `ultima_latitud` DECIMAL(10, 7) NULL,
    `ultima_longitud` DECIMAL(10, 7) NULL,
    `ultima_ubicacion_en` DATETIME(3) NULL,
    `creada_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ambulancias_codigo_key`(`codigo`),
    UNIQUE INDEX `ambulancias_placa_key`(`placa`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `turnos` (
    `id` CHAR(36) NOT NULL,
    `ambulancia_id` CHAR(36) NOT NULL,
    `inicio` DATETIME(3) NOT NULL,
    `fin` DATETIME(3) NULL,
    `estado` VARCHAR(30) NOT NULL DEFAULT 'activo',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `turnos_integrantes` (
    `turno_id` CHAR(36) NOT NULL,
    `usuario_id` CHAR(36) NOT NULL,
    `funcion` VARCHAR(60) NOT NULL,

    PRIMARY KEY (`turno_id`, `usuario_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `estados_ambulancia_historial` (
    `id` CHAR(36) NOT NULL,
    `ambulancia_id` CHAR(36) NOT NULL,
    `estado_anterior` VARCHAR(40) NULL,
    `estado_nuevo` VARCHAR(40) NOT NULL,
    `motivo` VARCHAR(255) NULL,
    `usuario_id` CHAR(36) NULL,
    `cambiado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `emergencias` (
    `id` CHAR(36) NOT NULL,
    `numero_emergencia` VARCHAR(40) NOT NULL,
    `fuente` VARCHAR(40) NOT NULL,
    `informante_nombre` VARCHAR(150) NULL,
    `informante_telefono` VARCHAR(30) NULL,
    `descripcion` TEXT NOT NULL,
    `tipo_incidente` VARCHAR(60) NULL,
    `prioridad` VARCHAR(30) NULL,
    `direccion` VARCHAR(255) NULL,
    `referencia_lugar` VARCHAR(255) NULL,
    `latitud` DECIMAL(10, 7) NULL,
    `longitud` DECIMAL(10, 7) NULL,
    `numero_victimas` INTEGER NULL,
    `estado` VARCHAR(40) NOT NULL DEFAULT 'recibida',
    `emergencia_principal_id` CHAR(36) NULL,
    `recibida_por_id` CHAR(36) NULL,
    `informante_usuario_id` CHAR(36) NULL,
    `origen_ubicacion` VARCHAR(20) NULL,
    `recibida_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `cerrada_en` DATETIME(3) NULL,

    UNIQUE INDEX `emergencias_numero_emergencia_key`(`numero_emergencia`),
    INDEX `emergencias_informante_usuario_id_recibida_en_idx`(`informante_usuario_id`, `recibida_en`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asignaciones_servicio` (
    `id` CHAR(36) NOT NULL,
    `emergencia_id` CHAR(36) NOT NULL,
    `ambulancia_id` CHAR(36) NOT NULL,
    `turno_id` CHAR(36) NULL,
    `asignada_por_id` CHAR(36) NULL,
    `estado` VARCHAR(40) NOT NULL DEFAULT 'asignada',
    `motivo_cancelacion` VARCHAR(255) NULL,
    `asignada_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `salida_en` DATETIME(3) NULL,
    `llegada_escena_en` DATETIME(3) NULL,
    `atencion_inicio_en` DATETIME(3) NULL,
    `salida_escena_en` DATETIME(3) NULL,
    `llegada_destino_en` DATETIME(3) NULL,
    `finalizada_en` DATETIME(3) NULL,
    `institucion_destino_id` CHAR(36) NULL,
    `destino_actualizado_por_id` CHAR(36) NULL,
    `destino_actualizado_en` DATETIME(3) NULL,

    INDEX `asignaciones_servicio_emergencia_id_idx`(`emergencia_id`),
    INDEX `asignaciones_servicio_ambulancia_id_estado_idx`(`ambulancia_id`, `estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rutas_asignacion` (
    `id` CHAR(36) NOT NULL,
    `asignacion_id` CHAR(36) NOT NULL,
    `tramo` VARCHAR(30) NOT NULL,
    `motivo` VARCHAR(30) NOT NULL,
    `origen_latitud` DECIMAL(10, 7) NOT NULL,
    `origen_longitud` DECIMAL(10, 7) NOT NULL,
    `destino_latitud` DECIMAL(10, 7) NOT NULL,
    `destino_longitud` DECIMAL(10, 7) NOT NULL,
    `geometria` JSON NOT NULL,
    `distancia_metros` INTEGER NOT NULL,
    `duracion_segundos` INTEGER NOT NULL,
    `proveedor` VARCHAR(40) NOT NULL,
    `calculada_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `rutas_asignacion_asignacion_id_calculada_en_idx`(`asignacion_id`, `calculada_en`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `eventos_asignacion` (
    `id` CHAR(36) NOT NULL,
    `asignacion_id` CHAR(36) NOT NULL,
    `estado_anterior` VARCHAR(40) NULL,
    `estado_nuevo` VARCHAR(40) NOT NULL,
    `usuario_id` CHAR(36) NULL,
    `rol_responsable` VARCHAR(30) NULL,
    `ocurrido_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `latitud` DECIMAL(10, 7) NULL,
    `longitud` DECIMAL(10, 7) NULL,
    `precision_metros` DECIMAL(7, 1) NULL,
    `distancia_escena_metros` DECIMAL(9, 1) NULL,
    `fuera_de_radio` BOOLEAN NOT NULL DEFAULT false,
    `observacion` VARCHAR(255) NULL,

    INDEX `eventos_asignacion_asignacion_id_ocurrido_en_idx`(`asignacion_id`, `ocurrido_en`),
    UNIQUE INDEX `eventos_asignacion_asignacion_id_estado_nuevo_key`(`asignacion_id`, `estado_nuevo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ubicaciones_ambulancias` (
    `id` CHAR(36) NOT NULL,
    `ambulancia_id` CHAR(36) NOT NULL,
    `asignacion_id` CHAR(36) NULL,
    `latitud` DECIMAL(10, 7) NOT NULL,
    `longitud` DECIMAL(10, 7) NOT NULL,
    `velocidad` DECIMAL(8, 2) NULL,
    `registrada_en` DATETIME(3) NOT NULL,

    INDEX `ubicaciones_ambulancias_ambulancia_id_registrada_en_idx`(`ambulancia_id`, `registrada_en`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `direcciones_geocodificadas` (
    `id` CHAR(36) NOT NULL,
    `direccion_original` VARCHAR(255) NOT NULL,
    `direccion_normalizada` VARCHAR(320) NOT NULL,
    `ciudad` VARCHAR(100) NULL,
    `direccion_formateada` VARCHAR(255) NULL,
    `latitud` DECIMAL(10, 7) NULL,
    `longitud` DECIMAL(10, 7) NULL,
    `proveedor` VARCHAR(40) NOT NULL,
    `proveedor_resultado_id` VARCHAR(512) NULL,
    `confianza` DECIMAL(4, 3) NULL,
    `estado` VARCHAR(30) NOT NULL,
    `creada_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizada_en` DATETIME(3) NOT NULL,

    UNIQUE INDEX `direcciones_geocodificadas_direccion_normalizada_key`(`direccion_normalizada`),
    INDEX `direcciones_geocodificadas_estado_actualizada_en_idx`(`estado`, `actualizada_en`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `geocodificaciones_inversas` (
    `id` CHAR(36) NOT NULL,
    `clave_punto` VARCHAR(40) NOT NULL,
    `latitud_solicitada` DECIMAL(10, 7) NOT NULL,
    `longitud_solicitada` DECIMAL(10, 7) NOT NULL,
    `direccion` VARCHAR(255) NULL,
    `linea_direccion` VARCHAR(255) NULL,
    `calle` VARCHAR(150) NULL,
    `numero` VARCHAR(50) NULL,
    `barrio` VARCHAR(150) NULL,
    `ciudad` VARCHAR(100) NULL,
    `departamento` VARCHAR(100) NULL,
    `codigo_postal` VARCHAR(20) NULL,
    `pais` VARCHAR(2) NULL,
    `latitud_direccion` DECIMAL(10, 7) NULL,
    `longitud_direccion` DECIMAL(10, 7) NULL,
    `distancia_metros` DECIMAL(9, 1) NULL,
    `precision` VARCHAR(20) NULL,
    `proveedor` VARCHAR(40) NOT NULL,
    `proveedor_resultado_id` VARCHAR(512) NULL,
    `estado` VARCHAR(30) NOT NULL,
    `creada_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizada_en` DATETIME(3) NOT NULL,

    UNIQUE INDEX `geocodificaciones_inversas_clave_punto_key`(`clave_punto`),
    INDEX `geocodificaciones_inversas_estado_actualizada_en_idx`(`estado`, `actualizada_en`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `instituciones_salud` (
    `id` CHAR(36) NOT NULL,
    `nombre` VARCHAR(180) NOT NULL,
    `codigo_habilitacion` VARCHAR(50) NULL,
    `nivel_complejidad` VARCHAR(20) NULL,
    `telefono` VARCHAR(30) NULL,
    `direccion` VARCHAR(255) NULL,
    `latitud` DECIMAL(10, 7) NULL,
    `longitud` DECIMAL(10, 7) NULL,
    `activa` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `historias_clinicas` (
    `id` CHAR(36) NOT NULL,
    `numero_historia` VARCHAR(50) NOT NULL,
    `emergencia_id` CHAR(36) NOT NULL,
    `asignacion_id` CHAR(36) NULL,
    `paciente_identificado` BOOLEAN NOT NULL DEFAULT false,
    `nombres` VARCHAR(150) NULL,
    `apellidos` VARCHAR(150) NULL,
    `tipo_documento` VARCHAR(30) NULL,
    `numero_documento` VARCHAR(40) NULL,
    `sexo` VARCHAR(20) NULL,
    `edad_aproximada` INTEGER NULL,
    `fecha_nacimiento` DATE NULL,
    `aseguradora_eps` VARCHAR(120) NULL,
    `acompanante_nombre` VARCHAR(150) NULL,
    `acompanante_telefono` VARCHAR(30) NULL,
    `hora_evento` DATETIME(3) NULL,
    `tipo_evento` VARCHAR(60) NULL,
    `mecanismo_lesion` TEXT NULL,
    `rol_victima` VARCHAR(40) NULL,
    `elementos_proteccion` VARCHAR(100) NULL,
    `placa_vehiculo` VARCHAR(20) NULL,
    `poliza_soat` VARCHAR(60) NULL,
    `x_hemorragia_masiva` VARCHAR(255) NULL,
    `a_via_aerea` VARCHAR(255) NULL,
    `b_respiracion` VARCHAR(255) NULL,
    `c_circulacion` VARCHAR(255) NULL,
    `d_neurologico` VARCHAR(255) NULL,
    `e_exposicion` VARCHAR(255) NULL,
    `triage` VARCHAR(20) NULL,
    `alergias` VARCHAR(255) NULL,
    `medicamentos_habituales` VARCHAR(255) NULL,
    `antecedentes` VARCHAR(255) NULL,
    `impresion_diagnostica` TEXT NULL,
    `observaciones` TEXT NULL,
    `desenlace` VARCHAR(40) NULL,
    `motivo_rechazo` TEXT NULL,
    `firma_rechazo_ref` VARCHAR(500) NULL,
    `institucion_destino_id` CHAR(36) NULL,
    `condicion_entrega` TEXT NULL,
    `receptor_nombre` VARCHAR(150) NULL,
    `receptor_cargo` VARCHAR(100) NULL,
    `entregado_en` DATETIME(3) NULL,
    `estado` VARCHAR(30) NOT NULL DEFAULT 'borrador',
    `creada_por_id` CHAR(36) NOT NULL,
    `cerrada_por_id` CHAR(36) NULL,
    `hash_cierre` VARCHAR(255) NULL,
    `abierta_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `cerrada_en` DATETIME(3) NULL,
    `sincronizada_en` DATETIME(3) NULL,

    UNIQUE INDEX `historias_clinicas_numero_historia_key`(`numero_historia`),
    INDEX `historias_clinicas_emergencia_id_idx`(`emergencia_id`),
    INDEX `historias_clinicas_numero_documento_idx`(`numero_documento`),
    INDEX `historias_clinicas_estado_abierta_en_idx`(`estado`, `abierta_en`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `signos_vitales` (
    `id` CHAR(36) NOT NULL,
    `historia_clinica_id` CHAR(36) NOT NULL,
    `medido_en` DATETIME(3) NOT NULL,
    `presion_sistolica` INTEGER NULL,
    `presion_diastolica` INTEGER NULL,
    `frecuencia_cardiaca` INTEGER NULL,
    `frecuencia_respiratoria` INTEGER NULL,
    `saturacion_oxigeno` INTEGER NULL,
    `temperatura` DECIMAL(4, 1) NULL,
    `glucometria` INTEGER NULL,
    `glasgow_ocular` TINYINT NULL,
    `glasgow_verbal` TINYINT NULL,
    `glasgow_motor` TINYINT NULL,
    `glasgow_total` TINYINT NULL,
    `escala_dolor` TINYINT NULL,
    `origen` VARCHAR(20) NOT NULL DEFAULT 'manual',
    `segmento_audio_id` CHAR(36) NULL,
    `confirmado` BOOLEAN NOT NULL DEFAULT false,
    `registrado_por_id` CHAR(36) NOT NULL,

    INDEX `signos_vitales_historia_clinica_id_medido_en_idx`(`historia_clinica_id`, `medido_en`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lesiones` (
    `id` CHAR(36) NOT NULL,
    `historia_clinica_id` CHAR(36) NOT NULL,
    `region_corporal` VARCHAR(60) NOT NULL,
    `tipo_lesion` VARCHAR(60) NOT NULL,
    `descripcion` VARCHAR(255) NULL,
    `origen` VARCHAR(20) NOT NULL DEFAULT 'manual',
    `segmento_audio_id` CHAR(36) NULL,
    `confirmado` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `intervenciones` (
    `id` CHAR(36) NOT NULL,
    `historia_clinica_id` CHAR(36) NOT NULL,
    `tipo` VARCHAR(30) NOT NULL,
    `nombre` VARCHAR(150) NOT NULL,
    `dosis` VARCHAR(60) NULL,
    `via` VARCHAR(40) NULL,
    `realizado_en` DATETIME(3) NULL,
    `resultado` VARCHAR(255) NULL,
    `origen` VARCHAR(20) NOT NULL DEFAULT 'manual',
    `segmento_audio_id` CHAR(36) NULL,
    `confirmado` BOOLEAN NOT NULL DEFAULT false,
    `registrado_por_id` CHAR(36) NOT NULL,

    INDEX `intervenciones_historia_clinica_id_realizado_en_idx`(`historia_clinica_id`, `realizado_en`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grabaciones` (
    `id` CHAR(36) NOT NULL,
    `historia_clinica_id` CHAR(36) NOT NULL,
    `iniciada_en` DATETIME(3) NOT NULL,
    `finalizada_en` DATETIME(3) NULL,
    `estado` VARCHAR(30) NOT NULL DEFAULT 'grabando',
    `motor_transcripcion` VARCHAR(80) NULL,
    `grabado_por_id` CHAR(36) NOT NULL,

    INDEX `grabaciones_historia_clinica_id_idx`(`historia_clinica_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `segmentos_audio` (
    `id` CHAR(36) NOT NULL,
    `grabacion_id` CHAR(36) NOT NULL,
    `orden` INTEGER NOT NULL,
    `inicio_seg` DECIMAL(8, 2) NOT NULL,
    `fin_seg` DECIMAL(8, 2) NULL,
    `audio_ref` VARCHAR(500) NULL,
    `hablante` VARCHAR(30) NULL,
    `transcripcion` TEXT NULL,
    `datos_extraidos` JSON NULL,
    `estado` VARCHAR(30) NOT NULL DEFAULT 'pendiente',

    UNIQUE INDEX `segmentos_audio_grabacion_id_orden_key`(`grabacion_id`, `orden`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `verificaciones_identidad` (
    `id` CHAR(36) NOT NULL,
    `usuario_id` CHAR(36) NOT NULL,
    `estado` VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    `motivo` VARCHAR(500) NULL,
    `enviada_en` DATETIME(3) NOT NULL,
    `revisada_por_id` CHAR(36) NULL,
    `revisada_en` DATETIME(3) NULL,

    UNIQUE INDEX `verificaciones_identidad_usuario_id_key`(`usuario_id`),
    INDEX `verificaciones_identidad_estado_enviada_en_idx`(`estado`, `enviada_en`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documentos_identidad` (
    `id` CHAR(36) NOT NULL,
    `verificacion_id` CHAR(36) NOT NULL,
    `lado` VARCHAR(20) NOT NULL,
    `clave_almacenamiento` VARCHAR(100) NOT NULL,
    `tipo_mime` VARCHAR(50) NOT NULL,
    `tamano_bytes` INTEGER NOT NULL,
    `huella_sha256` CHAR(64) NOT NULL,
    `vigente` BOOLEAN NOT NULL DEFAULT true,
    `cargado_en` DATETIME(3) NOT NULL,
    `reemplazado_en` DATETIME(3) NULL,

    UNIQUE INDEX `documentos_identidad_clave_almacenamiento_key`(`clave_almacenamiento`),
    INDEX `documentos_identidad_verificacion_id_vigente_idx`(`verificacion_id`, `vigente`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `historial_verificaciones` (
    `id` CHAR(36) NOT NULL,
    `verificacion_id` CHAR(36) NOT NULL,
    `estado_anterior` VARCHAR(30) NULL,
    `estado_nuevo` VARCHAR(30) NOT NULL,
    `motivo` VARCHAR(500) NULL,
    `observaciones` TEXT NULL,
    `responsable_id` CHAR(36) NOT NULL,
    `ocurrido_en` DATETIME(3) NOT NULL,

    INDEX `historial_verificaciones_verificacion_id_ocurrido_en_idx`(`verificacion_id`, `ocurrido_en`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_rol_id_fkey` FOREIGN KEY (`rol_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sesiones` ADD CONSTRAINT `sesiones_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auditoria_eventos` ADD CONSTRAINT `auditoria_eventos_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ambulancias` ADD CONSTRAINT `ambulancias_tipo_ambulancia_id_fkey` FOREIGN KEY (`tipo_ambulancia_id`) REFERENCES `tipos_ambulancia`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `turnos` ADD CONSTRAINT `turnos_ambulancia_id_fkey` FOREIGN KEY (`ambulancia_id`) REFERENCES `ambulancias`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `turnos_integrantes` ADD CONSTRAINT `turnos_integrantes_turno_id_fkey` FOREIGN KEY (`turno_id`) REFERENCES `turnos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `turnos_integrantes` ADD CONSTRAINT `turnos_integrantes_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `estados_ambulancia_historial` ADD CONSTRAINT `estados_ambulancia_historial_ambulancia_id_fkey` FOREIGN KEY (`ambulancia_id`) REFERENCES `ambulancias`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `estados_ambulancia_historial` ADD CONSTRAINT `estados_ambulancia_historial_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emergencias` ADD CONSTRAINT `emergencias_emergencia_principal_id_fkey` FOREIGN KEY (`emergencia_principal_id`) REFERENCES `emergencias`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emergencias` ADD CONSTRAINT `emergencias_recibida_por_id_fkey` FOREIGN KEY (`recibida_por_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emergencias` ADD CONSTRAINT `emergencias_informante_usuario_id_fkey` FOREIGN KEY (`informante_usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asignaciones_servicio` ADD CONSTRAINT `asignaciones_servicio_emergencia_id_fkey` FOREIGN KEY (`emergencia_id`) REFERENCES `emergencias`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asignaciones_servicio` ADD CONSTRAINT `asignaciones_servicio_ambulancia_id_fkey` FOREIGN KEY (`ambulancia_id`) REFERENCES `ambulancias`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asignaciones_servicio` ADD CONSTRAINT `asignaciones_servicio_turno_id_fkey` FOREIGN KEY (`turno_id`) REFERENCES `turnos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asignaciones_servicio` ADD CONSTRAINT `asignaciones_servicio_asignada_por_id_fkey` FOREIGN KEY (`asignada_por_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asignaciones_servicio` ADD CONSTRAINT `asignaciones_servicio_institucion_destino_id_fkey` FOREIGN KEY (`institucion_destino_id`) REFERENCES `instituciones_salud`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asignaciones_servicio` ADD CONSTRAINT `asignaciones_servicio_destino_actualizado_por_id_fkey` FOREIGN KEY (`destino_actualizado_por_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rutas_asignacion` ADD CONSTRAINT `rutas_asignacion_asignacion_id_fkey` FOREIGN KEY (`asignacion_id`) REFERENCES `asignaciones_servicio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `eventos_asignacion` ADD CONSTRAINT `eventos_asignacion_asignacion_id_fkey` FOREIGN KEY (`asignacion_id`) REFERENCES `asignaciones_servicio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `eventos_asignacion` ADD CONSTRAINT `eventos_asignacion_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ubicaciones_ambulancias` ADD CONSTRAINT `ubicaciones_ambulancias_ambulancia_id_fkey` FOREIGN KEY (`ambulancia_id`) REFERENCES `ambulancias`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ubicaciones_ambulancias` ADD CONSTRAINT `ubicaciones_ambulancias_asignacion_id_fkey` FOREIGN KEY (`asignacion_id`) REFERENCES `asignaciones_servicio`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historias_clinicas` ADD CONSTRAINT `historias_clinicas_emergencia_id_fkey` FOREIGN KEY (`emergencia_id`) REFERENCES `emergencias`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historias_clinicas` ADD CONSTRAINT `historias_clinicas_asignacion_id_fkey` FOREIGN KEY (`asignacion_id`) REFERENCES `asignaciones_servicio`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historias_clinicas` ADD CONSTRAINT `historias_clinicas_institucion_destino_id_fkey` FOREIGN KEY (`institucion_destino_id`) REFERENCES `instituciones_salud`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historias_clinicas` ADD CONSTRAINT `historias_clinicas_creada_por_id_fkey` FOREIGN KEY (`creada_por_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historias_clinicas` ADD CONSTRAINT `historias_clinicas_cerrada_por_id_fkey` FOREIGN KEY (`cerrada_por_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `signos_vitales` ADD CONSTRAINT `signos_vitales_historia_clinica_id_fkey` FOREIGN KEY (`historia_clinica_id`) REFERENCES `historias_clinicas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `signos_vitales` ADD CONSTRAINT `signos_vitales_segmento_audio_id_fkey` FOREIGN KEY (`segmento_audio_id`) REFERENCES `segmentos_audio`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `signos_vitales` ADD CONSTRAINT `signos_vitales_registrado_por_id_fkey` FOREIGN KEY (`registrado_por_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lesiones` ADD CONSTRAINT `lesiones_historia_clinica_id_fkey` FOREIGN KEY (`historia_clinica_id`) REFERENCES `historias_clinicas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lesiones` ADD CONSTRAINT `lesiones_segmento_audio_id_fkey` FOREIGN KEY (`segmento_audio_id`) REFERENCES `segmentos_audio`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `intervenciones` ADD CONSTRAINT `intervenciones_historia_clinica_id_fkey` FOREIGN KEY (`historia_clinica_id`) REFERENCES `historias_clinicas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `intervenciones` ADD CONSTRAINT `intervenciones_segmento_audio_id_fkey` FOREIGN KEY (`segmento_audio_id`) REFERENCES `segmentos_audio`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `intervenciones` ADD CONSTRAINT `intervenciones_registrado_por_id_fkey` FOREIGN KEY (`registrado_por_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grabaciones` ADD CONSTRAINT `grabaciones_historia_clinica_id_fkey` FOREIGN KEY (`historia_clinica_id`) REFERENCES `historias_clinicas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grabaciones` ADD CONSTRAINT `grabaciones_grabado_por_id_fkey` FOREIGN KEY (`grabado_por_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `segmentos_audio` ADD CONSTRAINT `segmentos_audio_grabacion_id_fkey` FOREIGN KEY (`grabacion_id`) REFERENCES `grabaciones`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `verificaciones_identidad` ADD CONSTRAINT `verificaciones_identidad_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `verificaciones_identidad` ADD CONSTRAINT `verificaciones_identidad_revisada_por_id_fkey` FOREIGN KEY (`revisada_por_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentos_identidad` ADD CONSTRAINT `documentos_identidad_verificacion_id_fkey` FOREIGN KEY (`verificacion_id`) REFERENCES `verificaciones_identidad`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historial_verificaciones` ADD CONSTRAINT `historial_verificaciones_verificacion_id_fkey` FOREIGN KEY (`verificacion_id`) REFERENCES `verificaciones_identidad`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historial_verificaciones` ADD CONSTRAINT `historial_verificaciones_responsable_id_fkey` FOREIGN KEY (`responsable_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

