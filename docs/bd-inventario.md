// ==========================================
// MODULO DE INVENTARIO - AMBULANCIAS
// Prefijo: inv_
// Alineado con las convenciones del esquema base:
//   - PK char(36) (UUID)
//   - Timestamps datetime(3), sufijo _en, con genero gramatical
//   - Booleanos tinyint(1)
//   - Estados/tipos en minuscula (snake_case)
// ==========================================

// 1. CATALOGOS

Table "inv_insumos" {
  "id" char(36) [pk, not null]
  "codigo" varchar(50) [not null]
  "nombre" varchar(150) [not null]
  "descripcion" text
  "tipo" varchar(40) [not null, note: 'medicamento, dispositivo_medico, insumo_asistencial, equipo_biomedico, oxigeno_medicinal, otro']
  "categoria" varchar(100)
  "unidad_medida" varchar(30) [not null]
  "marca" varchar(100)
  "fabricante" varchar(150)
  "requiere_lote" tinyint(1) [not null, default: '1']
  "requiere_vencimiento" tinyint(1) [not null, default: '0']
  "requiere_registro_sanitario" tinyint(1) [not null, default: '0']
  "requiere_serie" tinyint(1) [not null, default: '0']
  "es_control_especial" tinyint(1) [not null, default: '0']
  "stock_minimo" decimal(12,3) [not null, default: '0']
  "activo" tinyint(1) [not null, default: '1']
  "creado_en" datetime(3) [not null, default: `CURRENT_TIMESTAMP(3)`]
  "actualizado_en" datetime(3) [not null]

  Indexes {
    codigo [unique, name: "inv_insumos_codigo_key"]
    (tipo, activo) [name: "inv_insumos_tipo_activo_idx"]
  }
}

// 2. INFORMACION SANITARIA

Table "inv_registros_sanitarios" {
  "id" char(36) [pk, not null]
  "insumo_id" char(36) [not null]
  "numero_registro" varchar(100) [not null]
  "tipo_registro" varchar(50) [not null, note: 'registro_sanitario, permiso_comercializacion, notificacion_sanitaria, otro']
  "fecha_expedicion" date
  "fecha_vencimiento" date
  "titular" varchar(150)
  "documento_url" varchar(500)
  "estado" varchar(30) [not null, default: 'vigente']
  "creado_en" datetime(3) [not null, default: `CURRENT_TIMESTAMP(3)`]
  "actualizado_en" datetime(3) [not null]

  Indexes {
    (insumo_id, numero_registro) [unique, name: "inv_registros_sanitarios_insumo_id_numero_registro_key"]
    (estado, fecha_vencimiento) [name: "inv_registros_sanitarios_estado_fecha_vencimiento_idx"]
  }
}

// 3. BODEGAS Y UBICACIONES

Table "inv_bodegas" {
  "id" char(36) [pk, not null]
  "codigo" varchar(50) [not null]
  "nombre" varchar(150) [not null]
  "ubicacion" varchar(250)
  "responsable_id" char(36)
  "activa" tinyint(1) [not null, default: '1']
  "creada_en" datetime(3) [not null, default: `CURRENT_TIMESTAMP(3)`]
  "actualizada_en" datetime(3) [not null]

  Indexes {
    codigo [unique, name: "inv_bodegas_codigo_key"]
    responsable_id [name: "inv_bodegas_responsable_id_fkey"]
  }
}

// Una ubicacion representa una bodega o una ambulancia; solo uno de los dos FK debe tener valor.
// Reforzar con CHECK en la migracion (MySQL 8.0.16+):
//   CHECK ((tipo = 'bodega' AND bodega_id IS NOT NULL AND ambulancia_id IS NULL)
//       OR (tipo = 'ambulancia' AND ambulancia_id IS NOT NULL AND bodega_id IS NULL))
Table "inv_ubicaciones" {
  "id" char(36) [pk, not null]
  "tipo" varchar(30) [not null, note: 'bodega, ambulancia']
  "bodega_id" char(36)
  "ambulancia_id" char(36)
  "activa" tinyint(1) [not null, default: '1']
  "creada_en" datetime(3) [not null, default: `CURRENT_TIMESTAMP(3)`]
  "actualizada_en" datetime(3) [not null]

  Indexes {
    bodega_id [unique, name: "inv_ubicaciones_bodega_id_key"]
    ambulancia_id [unique, name: "inv_ubicaciones_ambulancia_id_key"]
  }
}

// 4. LOTES DE INSUMOS Y MEDICAMENTOS

Table "inv_lotes" {
  "id" char(36) [pk, not null]
  "insumo_id" char(36) [not null]
  "registro_sanitario_id" char(36)
  "numero_lote" varchar(100) [not null]
  "fecha_fabricacion" date
  "fecha_vencimiento" date
  "fabricante" varchar(150)
  "proveedor" varchar(150)
  "recibido_en" datetime(3)
  "documento_soporte" varchar(500)
  "observaciones" text
  "creado_en" datetime(3) [not null, default: `CURRENT_TIMESTAMP(3)`]

  Indexes {
    (insumo_id, numero_lote) [unique, name: "inv_lotes_insumo_id_numero_lote_key"]
    fecha_vencimiento [name: "inv_lotes_fecha_vencimiento_idx"]
    registro_sanitario_id [name: "inv_lotes_registro_sanitario_id_fkey"]
  }
}

// 5. EQUIPOS BIOMEDICOS INDIVIDUALES

Table "inv_equipos" {
  "id" char(36) [pk, not null]
  "insumo_id" char(36) [not null]
  "registro_sanitario_id" char(36)
  "numero_serie" varchar(100) [not null]
  "marca" varchar(100)
  "modelo" varchar(100)
  "fecha_adquisicion" date
  "estado" varchar(40) [not null, default: 'operativo', note: 'operativo, mantenimiento, fuera_servicio, baja']
  "fecha_ultimo_mantenimiento" date
  "fecha_proximo_mantenimiento" date
  "observaciones" text
  "creado_en" datetime(3) [not null, default: `CURRENT_TIMESTAMP(3)`]
  "actualizado_en" datetime(3) [not null]

  Indexes {
    numero_serie [unique, name: "inv_equipos_numero_serie_key"]
    insumo_id [name: "inv_equipos_insumo_id_fkey"]
    registro_sanitario_id [name: "inv_equipos_registro_sanitario_id_fkey"]
    (estado, fecha_proximo_mantenimiento) [name: "inv_equipos_estado_fecha_proximo_mantenimiento_idx"]
  }
}

// 6. EXISTENCIAS POR UBICACION Y LOTE / EQUIPO

Table "inv_existencias" {
  "id" char(36) [pk, not null]
  "ubicacion_id" char(36) [not null]
  "insumo_id" char(36) [not null]
  "lote_id" char(36)
  "equipo_id" char(36)
  "clave_control" varchar(120) [not null, note: 'Identificador unico: insumo:<id>, lote:<id> o equipo:<id>']
  "cantidad" decimal(12,3) [not null, default: '0']
  "actualizada_en" datetime(3) [not null]

  Indexes {
    (ubicacion_id, clave_control) [unique, name: "inv_existencias_ubicacion_id_clave_control_key"]
    (insumo_id, ubicacion_id) [name: "inv_existencias_insumo_id_ubicacion_id_idx"]
    lote_id [name: "inv_existencias_lote_id_fkey"]
    equipo_id [name: "inv_existencias_equipo_id_fkey"]
  }
}

// 7. MOVIMIENTOS DE INVENTARIO

Table "inv_movimientos" {
  "id" char(36) [pk, not null]
  "codigo" varchar(50) [not null]
  "tipo" varchar(30) [not null, note: 'entrada, transferencia, consumo, devolucion, ajuste, baja']
  "estado" varchar(20) [not null, default: 'borrador', note: 'borrador, confirmado, anulado']
  "origen_ubicacion_id" char(36)
  "destino_ubicacion_id" char(36)
  "asignacion_id" char(36)
  "usuario_id" char(36) [not null]
  "motivo" varchar(150)
  "observaciones" text
  "documento_referencia" varchar(150)
  "realizado_en" datetime(3) [not null]
  "creado_en" datetime(3) [not null, default: `CURRENT_TIMESTAMP(3)`]
  "actualizado_en" datetime(3) [not null]

  Indexes {
    codigo [unique, name: "inv_movimientos_codigo_key"]
    (tipo, estado, realizado_en) [name: "inv_movimientos_tipo_estado_realizado_en_idx"]
    asignacion_id [name: "inv_movimientos_asignacion_id_idx"]
    origen_ubicacion_id [name: "inv_movimientos_origen_ubicacion_id_fkey"]
    destino_ubicacion_id [name: "inv_movimientos_destino_ubicacion_id_fkey"]
    usuario_id [name: "inv_movimientos_usuario_id_fkey"]
  }
}

Table "inv_movimiento_detalles" {
  "id" char(36) [pk, not null]
  "movimiento_id" char(36) [not null]
  "insumo_id" char(36) [not null]
  "lote_id" char(36)
  "equipo_id" char(36)
  "cantidad" decimal(12,3) [not null]
  "observaciones" text

  Indexes {
    movimiento_id [name: "inv_movimiento_detalles_movimiento_id_idx"]
    insumo_id [name: "inv_movimiento_detalles_insumo_id_fkey"]
    lote_id [name: "inv_movimiento_detalles_lote_id_fkey"]
    equipo_id [name: "inv_movimiento_detalles_equipo_id_fkey"]
  }
}

// 8. REGISTRO DE CONDICIONES DE ALMACENAMIENTO

Table "inv_controles_almacenamiento" {
  "id" char(36) [pk, not null]
  "ubicacion_id" char(36) [not null]
  "usuario_id" char(36) [not null]
  "temperatura" decimal(6,2)
  "humedad" decimal(6,2)
  "registrado_en" datetime(3) [not null]
  "observaciones" text
  "creado_en" datetime(3) [not null, default: `CURRENT_TIMESTAMP(3)`]

  Indexes {
    (ubicacion_id, registrado_en) [name: "inv_controles_almacenamiento_ubicacion_id_registrado_en_idx"]
    usuario_id [name: "inv_controles_almacenamiento_usuario_id_fkey"]
  }
}

// 9. HISTORIAL DE MANTENIMIENTO DE EQUIPOS

Table "inv_mantenimientos" {
  "id" char(36) [pk, not null]
  "equipo_id" char(36) [not null]
  "tipo" varchar(30) [not null, note: 'preventivo, correctivo, calibracion']
  "fecha_mantenimiento" date [not null]
  "fecha_proximo" date
  "responsable" varchar(150)
  "proveedor" varchar(150)
  "documento_soporte" varchar(500)
  "resultado" varchar(50)
  "observaciones" text
  "creado_en" datetime(3) [not null, default: `CURRENT_TIMESTAMP(3)`]

  Indexes {
    (equipo_id, fecha_mantenimiento) [name: "inv_mantenimientos_equipo_id_fecha_mantenimiento_idx"]
  }
}

// 10. PERFILES DE DOTACION

Table "inv_perfiles_dotacion" {
  "id" char(36) [pk, not null]
  "tipo_ambulancia_id" char(36) [not null]
  "codigo" varchar(50) [not null]
  "nombre" varchar(150) [not null]
  "version" int [not null, default: '1']
  "descripcion" text
  "vigente_desde" date
  "vigente_hasta" date
  "activo" tinyint(1) [not null, default: '1']
  "creado_en" datetime(3) [not null, default: `CURRENT_TIMESTAMP(3)`]
  "actualizado_en" datetime(3) [not null]

  Indexes {
    (tipo_ambulancia_id, codigo, version) [unique, name: "inv_perfiles_dotacion_tipo_ambulancia_id_codigo_version_key"]
  }
}

Table "inv_perfil_dotacion_detalles" {
  "id" char(36) [pk, not null]
  "perfil_dotacion_id" char(36) [not null]
  "insumo_id" char(36) [not null]
  "cantidad_requerida" decimal(12,3) [not null]
  "cantidad_minima" decimal(12,3)
  "obligatorio" tinyint(1) [not null, default: '1']
  "observaciones" text

  Indexes {
    (perfil_dotacion_id, insumo_id) [unique, name: "inv_perfil_dotacion_detalles_perfil_dotacion_id_insumo_id_key"]
    insumo_id [name: "inv_perfil_dotacion_detalles_insumo_id_fkey"]
  }
}

// 11. VERIFICACIONES DE INVENTARIO

// Columnas revisada_por_id, revisada_en y resolucion: agregadas el 2026-11-13
// (migración 20261113130557_revision_verificaciones) para cerrar el ciclo de las
// novedades: quién las atendió, cuándo y cómo. No estaban en el diseño original.
Table "inv_verificaciones" {
  "id" char(36) [pk, not null]
  "ubicacion_id" char(36) [not null]
  "turno_id" char(36)
  "responsable_id" char(36) [not null]
  "tipo" varchar(30) [not null, note: 'inicio_turno, fin_turno, extraordinaria']
  "estado" varchar(30) [not null, default: 'borrador', note: 'borrador, completada, con_novedades']
  "iniciada_en" datetime(3) [not null]
  "finalizada_en" datetime(3)
  "observaciones" text
  "revisada_por_id" char(36) [note: 'Quién de la central atendió las novedades']
  "revisada_en" datetime(3) [note: 'Solo con estado con_novedades (CHECK inv_verificaciones_revision_check)']
  "resolucion" text [note: 'Cómo se resolvieron: ajuste, baja, reposición (citar códigos MOV-…)']
  "creada_en" datetime(3) [not null, default: `CURRENT_TIMESTAMP(3)`]
  "actualizada_en" datetime(3) [not null]

  Indexes {
    (ubicacion_id, iniciada_en) [name: "inv_verificaciones_ubicacion_id_iniciada_en_idx"]
    (responsable_id, iniciada_en) [name: "inv_verificaciones_responsable_id_iniciada_en_idx"]
    turno_id [name: "inv_verificaciones_turno_id_fkey"]
    estado [name: "inv_verificaciones_estado_idx"]
    (estado, revisada_en) [name: "inv_verificaciones_estado_revisada_en_idx"]
  }
}

Table "inv_verificacion_detalles" {
  "id" char(36) [pk, not null]
  "verificacion_id" char(36) [not null]
  "perfil_detalle_id" char(36)
  "insumo_id" char(36) [not null]
  "lote_id" char(36)
  "equipo_id" char(36)
  "cantidad_esperada" decimal(12,3) [not null, default: '0']
  "cantidad_encontrada" decimal(12,3) [not null, default: '0']
  "estado" varchar(30) [not null, note: 'conforme, faltante, sobrante, vencido, danado']
  "observaciones" text
  "creado_en" datetime(3) [not null, default: `CURRENT_TIMESTAMP(3)`]

  Indexes {
    verificacion_id [name: "inv_verificacion_detalles_verificacion_id_idx"]
    insumo_id [name: "inv_verificacion_detalles_insumo_id_fkey"]
    perfil_detalle_id [name: "inv_verificacion_detalles_perfil_detalle_id_fkey"]
    lote_id [name: "inv_verificacion_detalles_lote_id_fkey"]
    equipo_id [name: "inv_verificacion_detalles_equipo_id_fkey"]
  }
}

// ==========================================
// RELACIONES (misma politica que el esquema base:
// FK obligatoria -> delete: restrict, FK opcional -> delete: set null)
// ==========================================

// Sanitario, lotes, equipos
Ref "inv_registros_sanitarios_insumo_id_fkey": "inv_registros_sanitarios"."insumo_id" > "inv_insumos"."id" [update: cascade, delete: restrict]
Ref "inv_lotes_insumo_id_fkey": "inv_lotes"."insumo_id" > "inv_insumos"."id" [update: cascade, delete: restrict]
Ref "inv_lotes_registro_sanitario_id_fkey": "inv_lotes"."registro_sanitario_id" > "inv_registros_sanitarios"."id" [update: cascade, delete: set null]
Ref "inv_equipos_insumo_id_fkey": "inv_equipos"."insumo_id" > "inv_insumos"."id" [update: cascade, delete: restrict]
Ref "inv_equipos_registro_sanitario_id_fkey": "inv_equipos"."registro_sanitario_id" > "inv_registros_sanitarios"."id" [update: cascade, delete: set null]
Ref "inv_mantenimientos_equipo_id_fkey": "inv_mantenimientos"."equipo_id" > "inv_equipos"."id" [update: cascade, delete: restrict]

// Bodegas y ubicaciones
Ref "inv_bodegas_responsable_id_fkey": "inv_bodegas"."responsable_id" > "usuarios"."id" [update: cascade, delete: set null]
Ref "inv_ubicaciones_bodega_id_fkey": "inv_ubicaciones"."bodega_id" > "inv_bodegas"."id" [update: cascade, delete: restrict]
Ref "inv_ubicaciones_ambulancia_id_fkey": "inv_ubicaciones"."ambulancia_id" > "ambulancias"."id" [update: cascade, delete: restrict]

// Existencias
Ref "inv_existencias_ubicacion_id_fkey": "inv_existencias"."ubicacion_id" > "inv_ubicaciones"."id" [update: cascade, delete: restrict]
Ref "inv_existencias_insumo_id_fkey": "inv_existencias"."insumo_id" > "inv_insumos"."id" [update: cascade, delete: restrict]
Ref "inv_existencias_lote_id_fkey": "inv_existencias"."lote_id" > "inv_lotes"."id" [update: cascade, delete: restrict]
Ref "inv_existencias_equipo_id_fkey": "inv_existencias"."equipo_id" > "inv_equipos"."id" [update: cascade, delete: restrict]

// Movimientos
Ref "inv_movimientos_origen_ubicacion_id_fkey": "inv_movimientos"."origen_ubicacion_id" > "inv_ubicaciones"."id" [update: cascade, delete: restrict]
Ref "inv_movimientos_destino_ubicacion_id_fkey": "inv_movimientos"."destino_ubicacion_id" > "inv_ubicaciones"."id" [update: cascade, delete: restrict]
Ref "inv_movimientos_asignacion_id_fkey": "inv_movimientos"."asignacion_id" > "asignaciones_servicio"."id" [update: cascade, delete: set null]
Ref "inv_movimientos_usuario_id_fkey": "inv_movimientos"."usuario_id" > "usuarios"."id" [update: cascade, delete: restrict]
Ref "inv_movimiento_detalles_movimiento_id_fkey": "inv_movimiento_detalles"."movimiento_id" > "inv_movimientos"."id" [update: cascade, delete: restrict]
Ref "inv_movimiento_detalles_insumo_id_fkey": "inv_movimiento_detalles"."insumo_id" > "inv_insumos"."id" [update: cascade, delete: restrict]
Ref "inv_movimiento_detalles_lote_id_fkey": "inv_movimiento_detalles"."lote_id" > "inv_lotes"."id" [update: cascade, delete: restrict]
Ref "inv_movimiento_detalles_equipo_id_fkey": "inv_movimiento_detalles"."equipo_id" > "inv_equipos"."id" [update: cascade, delete: restrict]

// Almacenamiento
Ref "inv_controles_almacenamiento_ubicacion_id_fkey": "inv_controles_almacenamiento"."ubicacion_id" > "inv_ubicaciones"."id" [update: cascade, delete: restrict]
Ref "inv_controles_almacenamiento_usuario_id_fkey": "inv_controles_almacenamiento"."usuario_id" > "usuarios"."id" [update: cascade, delete: restrict]

// Perfiles de dotacion
Ref "inv_perfiles_dotacion_tipo_ambulancia_id_fkey": "inv_perfiles_dotacion"."tipo_ambulancia_id" > "tipos_ambulancia"."id" [update: cascade, delete: restrict]
Ref "inv_perfil_dotacion_detalles_perfil_dotacion_id_fkey": "inv_perfil_dotacion_detalles"."perfil_dotacion_id" > "inv_perfiles_dotacion"."id" [update: cascade, delete: restrict]
Ref "inv_perfil_dotacion_detalles_insumo_id_fkey": "inv_perfil_dotacion_detalles"."insumo_id" > "inv_insumos"."id" [update: cascade, delete: restrict]

// Verificaciones
Ref "inv_verificaciones_ubicacion_id_fkey": "inv_verificaciones"."ubicacion_id" > "inv_ubicaciones"."id" [update: cascade, delete: restrict]
Ref "inv_verificaciones_turno_id_fkey": "inv_verificaciones"."turno_id" > "turnos"."id" [update: cascade, delete: set null]
Ref "inv_verificaciones_responsable_id_fkey": "inv_verificaciones"."responsable_id" > "usuarios"."id" [update: cascade, delete: restrict]
Ref "inv_verificaciones_revisada_por_id_fkey": "inv_verificaciones"."revisada_por_id" > "usuarios"."id" [update: cascade, delete: set null]
Ref "inv_verificacion_detalles_verificacion_id_fkey": "inv_verificacion_detalles"."verificacion_id" > "inv_verificaciones"."id" [update: cascade, delete: restrict]
Ref "inv_verificacion_detalles_perfil_detalle_id_fkey": "inv_verificacion_detalles"."perfil_detalle_id" > "inv_perfil_dotacion_detalles"."id" [update: cascade, delete: set null]
Ref "inv_verificacion_detalles_insumo_id_fkey": "inv_verificacion_detalles"."insumo_id" > "inv_insumos"."id" [update: cascade, delete: restrict]
Ref "inv_verificacion_detalles_lote_id_fkey": "inv_verificacion_detalles"."lote_id" > "inv_lotes"."id" [update: cascade, delete: restrict]
Ref "inv_verificacion_detalles_equipo_id_fkey": "inv_verificacion_detalles"."equipo_id" > "inv_equipos"."id" [update: cascade, delete: restrict]
/////

 