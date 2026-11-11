-- MySQL dump 10.13  Distrib 8.4.11, for Linux (x86_64)
--
-- Host: localhost    Database: ambulancia
-- ------------------------------------------------------
-- Server version	8.4.11-0ubuntu0.26.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `_prisma_migrations`
--

DROP TABLE IF EXISTS `_prisma_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `_prisma_migrations` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `checksum` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logs` text COLLATE utf8mb4_unicode_ci,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `applied_steps_count` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ambulancias`
--

DROP TABLE IF EXISTS `ambulancias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ambulancias` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `codigo` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `placa` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tipo_ambulancia_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `estado_operativo` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'fuera_servicio',
  `ultima_latitud` decimal(10,7) DEFAULT NULL,
  `ultima_longitud` decimal(10,7) DEFAULT NULL,
  `ultima_ubicacion_en` datetime(3) DEFAULT NULL,
  `creada_en` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ambulancias_codigo_key` (`codigo`),
  UNIQUE KEY `ambulancias_placa_key` (`placa`),
  KEY `ambulancias_tipo_ambulancia_id_fkey` (`tipo_ambulancia_id`),
  CONSTRAINT `ambulancias_tipo_ambulancia_id_fkey` FOREIGN KEY (`tipo_ambulancia_id`) REFERENCES `tipos_ambulancia` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `asignaciones_servicio`
--

DROP TABLE IF EXISTS `asignaciones_servicio`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `asignaciones_servicio` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `emergencia_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ambulancia_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `turno_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `asignada_por_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `estado` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'asignada',
  `motivo_cancelacion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `asignada_en` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `salida_en` datetime(3) DEFAULT NULL,
  `llegada_escena_en` datetime(3) DEFAULT NULL,
  `salida_escena_en` datetime(3) DEFAULT NULL,
  `llegada_destino_en` datetime(3) DEFAULT NULL,
  `finalizada_en` datetime(3) DEFAULT NULL,
  `atencion_inicio_en` datetime(3) DEFAULT NULL,
  `destino_actualizado_en` datetime(3) DEFAULT NULL,
  `destino_actualizado_por_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `institucion_destino_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `asignaciones_servicio_emergencia_id_idx` (`emergencia_id`),
  KEY `asignaciones_servicio_ambulancia_id_estado_idx` (`ambulancia_id`,`estado`),
  KEY `asignaciones_servicio_turno_id_fkey` (`turno_id`),
  KEY `asignaciones_servicio_asignada_por_id_fkey` (`asignada_por_id`),
  KEY `asignaciones_servicio_institucion_destino_id_fkey` (`institucion_destino_id`),
  KEY `asignaciones_servicio_destino_actualizado_por_id_fkey` (`destino_actualizado_por_id`),
  CONSTRAINT `asignaciones_servicio_ambulancia_id_fkey` FOREIGN KEY (`ambulancia_id`) REFERENCES `ambulancias` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `asignaciones_servicio_asignada_por_id_fkey` FOREIGN KEY (`asignada_por_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `asignaciones_servicio_destino_actualizado_por_id_fkey` FOREIGN KEY (`destino_actualizado_por_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `asignaciones_servicio_emergencia_id_fkey` FOREIGN KEY (`emergencia_id`) REFERENCES `emergencias` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `asignaciones_servicio_institucion_destino_id_fkey` FOREIGN KEY (`institucion_destino_id`) REFERENCES `instituciones_salud` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `asignaciones_servicio_turno_id_fkey` FOREIGN KEY (`turno_id`) REFERENCES `turnos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `auditoria_eventos`
--

DROP TABLE IF EXISTS `auditoria_eventos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auditoria_eventos` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `usuario_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entidad` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entidad_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `accion` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `detalle` json DEFAULT NULL,
  `creado_en` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `auditoria_eventos_entidad_entidad_id_idx` (`entidad`,`entidad_id`),
  KEY `auditoria_eventos_usuario_id_creado_en_idx` (`usuario_id`,`creado_en`),
  CONSTRAINT `auditoria_eventos_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `direcciones_geocodificadas`
--

DROP TABLE IF EXISTS `direcciones_geocodificadas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `direcciones_geocodificadas` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `direccion_original` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `direccion_normalizada` varchar(320) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ciudad` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `direccion_formateada` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `latitud` decimal(10,7) DEFAULT NULL,
  `longitud` decimal(10,7) DEFAULT NULL,
  `proveedor` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `proveedor_resultado_id` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `confianza` decimal(4,3) DEFAULT NULL,
  `estado` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `creada_en` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `actualizada_en` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `direcciones_geocodificadas_direccion_normalizada_key` (`direccion_normalizada`),
  KEY `direcciones_geocodificadas_estado_actualizada_en_idx` (`estado`,`actualizada_en`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `documentos_identidad`
--

DROP TABLE IF EXISTS `documentos_identidad`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `documentos_identidad` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `verificacion_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lado` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clave_almacenamiento` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tipo_mime` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tamano_bytes` int NOT NULL,
  `huella_sha256` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vigente` tinyint(1) NOT NULL DEFAULT '1',
  `cargado_en` datetime(3) NOT NULL,
  `reemplazado_en` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `documentos_identidad_clave_almacenamiento_key` (`clave_almacenamiento`),
  KEY `documentos_identidad_verificacion_id_vigente_idx` (`verificacion_id`,`vigente`),
  CONSTRAINT `documentos_identidad_verificacion_id_fkey` FOREIGN KEY (`verificacion_id`) REFERENCES `verificaciones_identidad` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `emergencias`
--

DROP TABLE IF EXISTS `emergencias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `emergencias` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `numero_emergencia` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fuente` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `informante_nombre` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `informante_telefono` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `descripcion` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `tipo_incidente` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `prioridad` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `direccion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `referencia_lugar` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `latitud` decimal(10,7) DEFAULT NULL,
  `longitud` decimal(10,7) DEFAULT NULL,
  `numero_victimas` int DEFAULT NULL,
  `estado` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'recibida',
  `emergencia_principal_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recibida_por_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recibida_en` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `cerrada_en` datetime(3) DEFAULT NULL,
  `informante_usuario_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `origen_ubicacion` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `emergencias_numero_emergencia_key` (`numero_emergencia`),
  KEY `emergencias_emergencia_principal_id_fkey` (`emergencia_principal_id`),
  KEY `emergencias_recibida_por_id_fkey` (`recibida_por_id`),
  KEY `emergencias_informante_usuario_id_recibida_en_idx` (`informante_usuario_id`,`recibida_en`),
  CONSTRAINT `emergencias_emergencia_principal_id_fkey` FOREIGN KEY (`emergencia_principal_id`) REFERENCES `emergencias` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `emergencias_informante_usuario_id_fkey` FOREIGN KEY (`informante_usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `emergencias_recibida_por_id_fkey` FOREIGN KEY (`recibida_por_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `estados_ambulancia_historial`
--

DROP TABLE IF EXISTS `estados_ambulancia_historial`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `estados_ambulancia_historial` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ambulancia_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `estado_anterior` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `estado_nuevo` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `motivo` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `usuario_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cambiado_en` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `estados_ambulancia_historial_ambulancia_id_fkey` (`ambulancia_id`),
  KEY `estados_ambulancia_historial_usuario_id_fkey` (`usuario_id`),
  CONSTRAINT `estados_ambulancia_historial_ambulancia_id_fkey` FOREIGN KEY (`ambulancia_id`) REFERENCES `ambulancias` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `estados_ambulancia_historial_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `eventos_asignacion`
--

DROP TABLE IF EXISTS `eventos_asignacion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `eventos_asignacion` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `asignacion_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `estado_anterior` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `estado_nuevo` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `usuario_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rol_responsable` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ocurrido_en` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `latitud` decimal(10,7) DEFAULT NULL,
  `longitud` decimal(10,7) DEFAULT NULL,
  `precision_metros` decimal(7,1) DEFAULT NULL,
  `distancia_escena_metros` decimal(9,1) DEFAULT NULL,
  `fuera_de_radio` tinyint(1) NOT NULL DEFAULT '0',
  `observacion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `eventos_asignacion_asignacion_id_estado_nuevo_key` (`asignacion_id`,`estado_nuevo`),
  KEY `eventos_asignacion_asignacion_id_ocurrido_en_idx` (`asignacion_id`,`ocurrido_en`),
  KEY `eventos_asignacion_usuario_id_fkey` (`usuario_id`),
  CONSTRAINT `eventos_asignacion_asignacion_id_fkey` FOREIGN KEY (`asignacion_id`) REFERENCES `asignaciones_servicio` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `eventos_asignacion_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `geocodificaciones_inversas`
--

DROP TABLE IF EXISTS `geocodificaciones_inversas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `geocodificaciones_inversas` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clave_punto` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `latitud_solicitada` decimal(10,7) NOT NULL,
  `longitud_solicitada` decimal(10,7) NOT NULL,
  `direccion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `linea_direccion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `calle` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `numero` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `barrio` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ciudad` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `departamento` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `codigo_postal` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pais` varchar(2) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `latitud_direccion` decimal(10,7) DEFAULT NULL,
  `longitud_direccion` decimal(10,7) DEFAULT NULL,
  `distancia_metros` decimal(9,1) DEFAULT NULL,
  `precision` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `proveedor` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `proveedor_resultado_id` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `estado` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `creada_en` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `actualizada_en` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `geocodificaciones_inversas_clave_punto_key` (`clave_punto`),
  KEY `geocodificaciones_inversas_estado_actualizada_en_idx` (`estado`,`actualizada_en`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `grabaciones`
--

DROP TABLE IF EXISTS `grabaciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `grabaciones` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `historia_clinica_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `iniciada_en` datetime(3) NOT NULL,
  `finalizada_en` datetime(3) DEFAULT NULL,
  `estado` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'grabando',
  `motor_transcripcion` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `grabado_por_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `grabaciones_historia_clinica_id_idx` (`historia_clinica_id`),
  KEY `grabaciones_grabado_por_id_fkey` (`grabado_por_id`),
  CONSTRAINT `grabaciones_grabado_por_id_fkey` FOREIGN KEY (`grabado_por_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `grabaciones_historia_clinica_id_fkey` FOREIGN KEY (`historia_clinica_id`) REFERENCES `historias_clinicas` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `historial_verificaciones`
--

DROP TABLE IF EXISTS `historial_verificaciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `historial_verificaciones` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `verificacion_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `estado_anterior` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `estado_nuevo` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `motivo` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `observaciones` text COLLATE utf8mb4_unicode_ci,
  `responsable_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ocurrido_en` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `historial_verificaciones_verificacion_id_ocurrido_en_idx` (`verificacion_id`,`ocurrido_en`),
  KEY `historial_verificaciones_responsable_id_fkey` (`responsable_id`),
  CONSTRAINT `historial_verificaciones_responsable_id_fkey` FOREIGN KEY (`responsable_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `historial_verificaciones_verificacion_id_fkey` FOREIGN KEY (`verificacion_id`) REFERENCES `verificaciones_identidad` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `historias_clinicas`
--

DROP TABLE IF EXISTS `historias_clinicas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `historias_clinicas` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `numero_historia` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `emergencia_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `asignacion_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paciente_identificado` tinyint(1) NOT NULL DEFAULT '0',
  `nombres` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `apellidos` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tipo_documento` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `numero_documento` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sexo` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `edad_aproximada` int DEFAULT NULL,
  `fecha_nacimiento` date DEFAULT NULL,
  `aseguradora_eps` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `acompanante_nombre` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `acompanante_telefono` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hora_evento` datetime(3) DEFAULT NULL,
  `tipo_evento` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mecanismo_lesion` text COLLATE utf8mb4_unicode_ci,
  `rol_victima` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `elementos_proteccion` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `placa_vehiculo` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `poliza_soat` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `x_hemorragia_masiva` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `a_via_aerea` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `b_respiracion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `c_circulacion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `d_neurologico` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `e_exposicion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `triage` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `alergias` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `medicamentos_habituales` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `antecedentes` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `impresion_diagnostica` text COLLATE utf8mb4_unicode_ci,
  `observaciones` text COLLATE utf8mb4_unicode_ci,
  `desenlace` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `motivo_rechazo` text COLLATE utf8mb4_unicode_ci,
  `firma_rechazo_ref` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `institucion_destino_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `condicion_entrega` text COLLATE utf8mb4_unicode_ci,
  `receptor_nombre` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `receptor_cargo` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entregado_en` datetime(3) DEFAULT NULL,
  `estado` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'borrador',
  `creada_por_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cerrada_por_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hash_cierre` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `abierta_en` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `cerrada_en` datetime(3) DEFAULT NULL,
  `sincronizada_en` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `historias_clinicas_numero_historia_key` (`numero_historia`),
  KEY `historias_clinicas_emergencia_id_idx` (`emergencia_id`),
  KEY `historias_clinicas_numero_documento_idx` (`numero_documento`),
  KEY `historias_clinicas_estado_abierta_en_idx` (`estado`,`abierta_en`),
  KEY `historias_clinicas_asignacion_id_fkey` (`asignacion_id`),
  KEY `historias_clinicas_institucion_destino_id_fkey` (`institucion_destino_id`),
  KEY `historias_clinicas_creada_por_id_fkey` (`creada_por_id`),
  KEY `historias_clinicas_cerrada_por_id_fkey` (`cerrada_por_id`),
  CONSTRAINT `historias_clinicas_asignacion_id_fkey` FOREIGN KEY (`asignacion_id`) REFERENCES `asignaciones_servicio` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `historias_clinicas_cerrada_por_id_fkey` FOREIGN KEY (`cerrada_por_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `historias_clinicas_creada_por_id_fkey` FOREIGN KEY (`creada_por_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `historias_clinicas_emergencia_id_fkey` FOREIGN KEY (`emergencia_id`) REFERENCES `emergencias` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `historias_clinicas_institucion_destino_id_fkey` FOREIGN KEY (`institucion_destino_id`) REFERENCES `instituciones_salud` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `instituciones_salud`
--

DROP TABLE IF EXISTS `instituciones_salud`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `instituciones_salud` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nombre` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `codigo_habilitacion` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nivel_complejidad` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telefono` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `direccion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `latitud` decimal(10,7) DEFAULT NULL,
  `longitud` decimal(10,7) DEFAULT NULL,
  `activa` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `intervenciones`
--

DROP TABLE IF EXISTS `intervenciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `intervenciones` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `historia_clinica_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tipo` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nombre` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dosis` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `via` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `realizado_en` datetime(3) DEFAULT NULL,
  `resultado` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `origen` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'manual',
  `segmento_audio_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `confirmado` tinyint(1) NOT NULL DEFAULT '0',
  `registrado_por_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `intervenciones_historia_clinica_id_realizado_en_idx` (`historia_clinica_id`,`realizado_en`),
  KEY `intervenciones_segmento_audio_id_fkey` (`segmento_audio_id`),
  KEY `intervenciones_registrado_por_id_fkey` (`registrado_por_id`),
  CONSTRAINT `intervenciones_historia_clinica_id_fkey` FOREIGN KEY (`historia_clinica_id`) REFERENCES `historias_clinicas` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `intervenciones_registrado_por_id_fkey` FOREIGN KEY (`registrado_por_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `intervenciones_segmento_audio_id_fkey` FOREIGN KEY (`segmento_audio_id`) REFERENCES `segmentos_audio` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lesiones`
--

DROP TABLE IF EXISTS `lesiones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lesiones` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `historia_clinica_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `region_corporal` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tipo_lesion` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descripcion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `origen` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'manual',
  `segmento_audio_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `confirmado` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `lesiones_historia_clinica_id_fkey` (`historia_clinica_id`),
  KEY `lesiones_segmento_audio_id_fkey` (`segmento_audio_id`),
  CONSTRAINT `lesiones_historia_clinica_id_fkey` FOREIGN KEY (`historia_clinica_id`) REFERENCES `historias_clinicas` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `lesiones_segmento_audio_id_fkey` FOREIGN KEY (`segmento_audio_id`) REFERENCES `segmentos_audio` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nombre` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descripcion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `roles_nombre_key` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `rutas_asignacion`
--

DROP TABLE IF EXISTS `rutas_asignacion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rutas_asignacion` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `asignacion_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tramo` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `motivo` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `origen_latitud` decimal(10,7) NOT NULL,
  `origen_longitud` decimal(10,7) NOT NULL,
  `destino_latitud` decimal(10,7) NOT NULL,
  `destino_longitud` decimal(10,7) NOT NULL,
  `geometria` json NOT NULL,
  `distancia_metros` int NOT NULL,
  `duracion_segundos` int NOT NULL,
  `proveedor` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `calculada_en` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `rutas_asignacion_asignacion_id_calculada_en_idx` (`asignacion_id`,`calculada_en`),
  CONSTRAINT `rutas_asignacion_asignacion_id_fkey` FOREIGN KEY (`asignacion_id`) REFERENCES `asignaciones_servicio` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `segmentos_audio`
--

DROP TABLE IF EXISTS `segmentos_audio`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `segmentos_audio` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `grabacion_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `orden` int NOT NULL,
  `inicio_seg` decimal(8,2) NOT NULL,
  `fin_seg` decimal(8,2) DEFAULT NULL,
  `audio_ref` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hablante` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `transcripcion` text COLLATE utf8mb4_unicode_ci,
  `datos_extraidos` json DEFAULT NULL,
  `estado` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pendiente',
  PRIMARY KEY (`id`),
  UNIQUE KEY `segmentos_audio_grabacion_id_orden_key` (`grabacion_id`,`orden`),
  CONSTRAINT `segmentos_audio_grabacion_id_fkey` FOREIGN KEY (`grabacion_id`) REFERENCES `grabaciones` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sesiones`
--

DROP TABLE IF EXISTS `sesiones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sesiones` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `usuario_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expira_en` datetime(3) NOT NULL,
  `revocada_en` datetime(3) DEFAULT NULL,
  `creada_en` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `sesiones_usuario_id_idx` (`usuario_id`),
  CONSTRAINT `sesiones_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `signos_vitales`
--

DROP TABLE IF EXISTS `signos_vitales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `signos_vitales` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `historia_clinica_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `medido_en` datetime(3) NOT NULL,
  `presion_sistolica` int DEFAULT NULL,
  `presion_diastolica` int DEFAULT NULL,
  `frecuencia_cardiaca` int DEFAULT NULL,
  `frecuencia_respiratoria` int DEFAULT NULL,
  `saturacion_oxigeno` int DEFAULT NULL,
  `temperatura` decimal(4,1) DEFAULT NULL,
  `glucometria` int DEFAULT NULL,
  `glasgow_ocular` tinyint DEFAULT NULL,
  `glasgow_verbal` tinyint DEFAULT NULL,
  `glasgow_motor` tinyint DEFAULT NULL,
  `glasgow_total` tinyint DEFAULT NULL,
  `escala_dolor` tinyint DEFAULT NULL,
  `origen` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'manual',
  `segmento_audio_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `confirmado` tinyint(1) NOT NULL DEFAULT '0',
  `registrado_por_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `signos_vitales_historia_clinica_id_medido_en_idx` (`historia_clinica_id`,`medido_en`),
  KEY `signos_vitales_segmento_audio_id_fkey` (`segmento_audio_id`),
  KEY `signos_vitales_registrado_por_id_fkey` (`registrado_por_id`),
  CONSTRAINT `signos_vitales_historia_clinica_id_fkey` FOREIGN KEY (`historia_clinica_id`) REFERENCES `historias_clinicas` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `signos_vitales_registrado_por_id_fkey` FOREIGN KEY (`registrado_por_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `signos_vitales_segmento_audio_id_fkey` FOREIGN KEY (`segmento_audio_id`) REFERENCES `segmentos_audio` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tipos_ambulancia`
--

DROP TABLE IF EXISTS `tipos_ambulancia`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tipos_ambulancia` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nombre` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descripcion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tipos_ambulancia_nombre_key` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `turnos`
--

DROP TABLE IF EXISTS `turnos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `turnos` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ambulancia_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `inicio` datetime(3) NOT NULL,
  `fin` datetime(3) DEFAULT NULL,
  `estado` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'activo',
  PRIMARY KEY (`id`),
  KEY `turnos_ambulancia_id_fkey` (`ambulancia_id`),
  CONSTRAINT `turnos_ambulancia_id_fkey` FOREIGN KEY (`ambulancia_id`) REFERENCES `ambulancias` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `turnos_integrantes`
--

DROP TABLE IF EXISTS `turnos_integrantes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `turnos_integrantes` (
  `turno_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `usuario_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `funcion` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`turno_id`,`usuario_id`),
  KEY `turnos_integrantes_usuario_id_fkey` (`usuario_id`),
  CONSTRAINT `turnos_integrantes_turno_id_fkey` FOREIGN KEY (`turno_id`) REFERENCES `turnos` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `turnos_integrantes_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ubicaciones_ambulancias`
--

DROP TABLE IF EXISTS `ubicaciones_ambulancias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ubicaciones_ambulancias` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ambulancia_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `asignacion_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `latitud` decimal(10,7) NOT NULL,
  `longitud` decimal(10,7) NOT NULL,
  `velocidad` decimal(8,2) DEFAULT NULL,
  `registrada_en` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ubicaciones_ambulancias_ambulancia_id_registrada_en_idx` (`ambulancia_id`,`registrada_en`),
  KEY `ubicaciones_ambulancias_asignacion_id_fkey` (`asignacion_id`),
  CONSTRAINT `ubicaciones_ambulancias_ambulancia_id_fkey` FOREIGN KEY (`ambulancia_id`) REFERENCES `ambulancias` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ubicaciones_ambulancias_asignacion_id_fkey` FOREIGN KEY (`asignacion_id`) REFERENCES `asignaciones_servicio` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `usuarios`
--

DROP TABLE IF EXISTS `usuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuarios` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rol_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nombres` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `apellidos` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tipo_documento` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `numero_documento` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `correo` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `telefono` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `registro_profesional` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contrasena_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `estado` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'activo',
  `ultimo_acceso` datetime(3) DEFAULT NULL,
  `creado_en` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `fecha_nacimiento` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `usuarios_correo_key` (`correo`),
  UNIQUE KEY `usuarios_numero_documento_key` (`numero_documento`),
  KEY `usuarios_rol_id_fkey` (`rol_id`),
  CONSTRAINT `usuarios_rol_id_fkey` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `verificaciones_identidad`
--

DROP TABLE IF EXISTS `verificaciones_identidad`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `verificaciones_identidad` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `usuario_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `estado` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pendiente',
  `motivo` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `enviada_en` datetime(3) NOT NULL,
  `revisada_por_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `revisada_en` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `verificaciones_identidad_usuario_id_key` (`usuario_id`),
  KEY `verificaciones_identidad_estado_enviada_en_idx` (`estado`,`enviada_en`),
  KEY `verificaciones_identidad_revisada_por_id_fkey` (`revisada_por_id`),
  CONSTRAINT `verificaciones_identidad_revisada_por_id_fkey` FOREIGN KEY (`revisada_por_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `verificaciones_identidad_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed
