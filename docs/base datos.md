// ==========================================
// OBSOLETO — NO USAR
// Modelo de datos anterior (permisos, tripulaciones, multiples roles, etc.).
// Se conserva solo como referencia historica.
// Modelo vigente: docs/ambulancias_galenos (1).dbml -> prisma/schema.prisma
// ==========================================


Project ambulancias_galenos {
  database_type: 'MySQL'
  Note: 'Sistema integral de despacho de ambulancias y atencion prehospitalaria'
}

// ==========================================
// 1. USUARIOS, ROLES Y PERMISOS
// ==========================================

Table usuarios {
  id char(36) [pk]
  nombres varchar(100) [not null]
  apellidos varchar(100) [not null]
  correo varchar(150) [unique, not null]
  telefono varchar(30)
  contrasena_hash varchar(255) [not null]
  estado varchar(30) [not null, default: 'activo']
  ultimo_acceso datetime
  creado_en datetime [not null]
  actualizado_en datetime
}

Table roles {
  id char(36) [pk]
  nombre varchar(60) [unique, not null]
  descripcion varchar(255)
  activo boolean [not null, default: true]
}

Table permisos {
  id char(36) [pk]
  codigo varchar(100) [unique, not null]
  descripcion varchar(255)
}

Table usuarios_roles {
  usuario_id char(36) [not null]
  rol_id char(36) [not null]

  indexes {
    (usuario_id, rol_id) [pk]
  }
}

Table roles_permisos {
  rol_id char(36) [not null]
  permiso_id char(36) [not null]

  indexes {
    (rol_id, permiso_id) [pk]
  }
}

Table sesiones {
  id char(36) [pk]
  usuario_id char(36) [not null]
  token_hash varchar(255) [not null]
  expira_en datetime [not null]
  revocada_en datetime
  creada_en datetime [not null]
}

Table auditoria_eventos {
  id char(36) [pk]
  usuario_id char(36)
  entidad varchar(100) [not null]
  entidad_id varchar(100) [not null]
  accion varchar(60) [not null]
  detalle json
  direccion_ip varchar(45)
  creado_en datetime [not null]

  indexes {
    (entidad, entidad_id)
    (usuario_id, creado_en)
  }
}

// ==========================================
// 2. PERSONAL, AMBULANCIAS Y TRIPULACIONES
// ==========================================

Table tipos_ambulancia {
  id char(36) [pk]
  nombre varchar(80) [unique, not null]
  descripcion varchar(255)
  capacidad_pacientes int
  requisitos json
  activo boolean [not null, default: true]
}

Table ambulancias {
  id char(36) [pk]
  codigo varchar(30) [unique, not null]
  placa varchar(20) [unique, not null]
  tipo_ambulancia_id char(36) [not null]
  marca varchar(80)
  modelo varchar(80)
  anio int
  estado_operativo varchar(40) [not null, default: 'fuera_servicio']
  ultima_latitud decimal(10,7)
  ultima_longitud decimal(10,7)
  ultima_ubicacion_en datetime
  creada_en datetime [not null]
  actualizada_en datetime
}

Table personal {
  id char(36) [pk]
  usuario_id char(36) [unique]
  tipo_documento varchar(30)
  numero_documento varchar(40) [unique]
  nombres varchar(100) [not null]
  apellidos varchar(100) [not null]
  telefono varchar(30)
  correo varchar(150)
  cargo varchar(80) [not null]
  estado varchar(30) [not null, default: 'activo']
  creado_en datetime [not null]
}

Table personal_credenciales {
  id char(36) [pk]
  personal_id char(36) [not null]
  tipo_credencial varchar(80) [not null]
  numero_credencial varchar(100)
  entidad_emisora varchar(150)
  expedida_en date
  vence_en date
  verificada boolean [not null, default: false]
  documento_ref varchar(500)
  creado_en datetime [not null]
}

Table tripulaciones {
  id char(36) [pk]
  codigo varchar(30) [unique, not null]
  nombre varchar(100)
  estado varchar(30) [not null, default: 'inactiva']
  creado_en datetime [not null]
}

Table tripulaciones_integrantes {
  id char(36) [pk]
  tripulacion_id char(36) [not null]
  personal_id char(36) [not null]
  funcion varchar(80) [not null]
  desde datetime [not null]
  hasta datetime

  indexes {
    (tripulacion_id, personal_id, desde)
  }
}

Table turnos_operativos {
  id char(36) [pk]
  personal_id char(36) [not null]
  ambulancia_id char(36)
  tripulacion_id char(36)
  inicio datetime [not null]
  fin datetime
  estado varchar(30) [not null, default: 'programado']
}

Table estados_ambulancia_historial {
  id char(36) [pk]
  ambulancia_id char(36) [not null]
  estado_anterior varchar(40)
  estado_nuevo varchar(40) [not null]
  motivo varchar(255)
  usuario_id char(36)
  cambiado_en datetime [not null]
}

Table mantenimientos_ambulancias {
  id char(36) [pk]
  ambulancia_id char(36) [not null]
  tipo varchar(60) [not null]
  descripcion text
  inicio datetime [not null]
  fin datetime
  costo decimal(12,2)
  estado varchar(30) [not null]
  responsable varchar(150)
}

// ==========================================
// 3. REPORTES Y EMERGENCIAS
// ==========================================

Table fuentes_reporte {
  id char(36) [pk]
  nombre varchar(80) [unique, not null]
  descripcion varchar(255)
  activo boolean [not null, default: true]
}

Table reportes_emergencia {
  id char(36) [pk]
  numero_reporte varchar(40) [unique, not null]
  fuente_reporte_id char(36) [not null]
  recibido_por_id char(36)
  informante_nombre varchar(150)
  informante_telefono varchar(30)
  descripcion text [not null]
  direccion varchar(255)
  referencia_lugar varchar(255)
  latitud decimal(10,7)
  longitud decimal(10,7)
  recibido_en datetime [not null]
  estado varchar(40) [not null, default: 'recibido']
  resultado_revision varchar(100)
  observaciones_revision text
  actualizado_en datetime
}

Table emergencias {
  id char(36) [pk]
  numero_emergencia varchar(40) [unique, not null]
  clasificacion varchar(80)
  prioridad varchar(30)
  descripcion_operativa text
  direccion varchar(255)
  latitud decimal(10,7)
  longitud decimal(10,7)
  referencia_lugar varchar(255)
  estado varchar(40) [not null, default: 'registrada']
  recibida_en datetime [not null]
  validada_en datetime
  cerrada_en datetime
  creada_por_id char(36)
  actualizada_en datetime
}

Table emergencias_reportes {
  emergencia_id char(36) [not null]
  reporte_id char(36) [not null]
  vinculado_por_id char(36)
  vinculado_en datetime [not null]
  motivo varchar(255)

  indexes {
    (emergencia_id, reporte_id) [pk]
    (reporte_id)
  }
}

Table emergencias_ubicaciones {
  id char(36) [pk]
  emergencia_id char(36) [not null]
  direccion varchar(255)
  latitud decimal(10,7)
  longitud decimal(10,7)
  referencia varchar(255)
  tipo varchar(40) [not null]
  registrada_por_id char(36)
  registrada_en datetime [not null]
}

Table emergencias_historial_estados {
  id char(36) [pk]
  emergencia_id char(36) [not null]
  estado_anterior varchar(40)
  estado_nuevo varchar(40) [not null]
  motivo varchar(255)
  usuario_id char(36)
  cambiado_en datetime [not null]
}

Table alertas_duplicados {
  id char(36) [pk]
  reporte_origen_id char(36) [not null]
  reporte_coincidente_id char(36)
  emergencia_coincidente_id char(36)
  puntuacion_coincidencia decimal(5,2)
  motivo text
  estado_revision varchar(40) [not null, default: 'pendiente']
  revisado_por_id char(36)
  revisado_en datetime
  resolucion text
  creada_en datetime [not null]
}

// ==========================================
// 4. ASIGNACIONES, DESPACHO Y GPS
// ==========================================

Table asignaciones_servicio {
  id char(36) [pk]
  emergencia_id char(36) [not null]
  ambulancia_id char(36) [not null]
  tripulacion_id char(36)
  asignada_por_id char(36)
  estado varchar(40) [not null, default: 'propuesta']
  prioridad varchar(30)
  motivo_cancelacion text
  asignada_en datetime [not null]
  aceptada_en datetime
  salida_en datetime
  llegada_lugar_en datetime
  inicio_traslado_en datetime
  llegada_destino_en datetime
  finalizada_en datetime

  indexes {
    (emergencia_id, estado)
    (ambulancia_id, estado)
    (asignada_en)
  }
}

Table asignaciones_historial_estados {
  id char(36) [pk]
  asignacion_id char(36) [not null]
  estado_anterior varchar(40)
  estado_nuevo varchar(40) [not null]
  latitud decimal(10,7)
  longitud decimal(10,7)
  observaciones text
  usuario_id char(36)
  cambiado_en datetime [not null]
}

Table ubicaciones_ambulancias {
  id char(36) [pk]
  ambulancia_id char(36) [not null]
  asignacion_id char(36)
  latitud decimal(10,7) [not null]
  longitud decimal(10,7) [not null]
  precision_metros decimal(8,2)
  velocidad decimal(8,2)
  rumbo decimal(6,2)
  origen varchar(40)
  registrada_en datetime [not null]
  recibida_en datetime [not null]

  indexes {
    (ambulancia_id, registrada_en)
    (asignacion_id, registrada_en)
  }
}

Table servicios_tiempos {
  id char(36) [pk]
  asignacion_id char(36) [not null]
  tipo_evento varchar(60) [not null]
  fecha_hora datetime [not null]
  fuente varchar(40)
  registrado_por_id char(36)
  observacion varchar(255)

  indexes {
    (asignacion_id, tipo_evento, fecha_hora)
  }
}

Table eventos_operativos {
  id char(36) [pk]
  tipo_evento varchar(100) [not null]
  entidad varchar(100) [not null]
  entidad_id char(36) [not null]
  datos json
  ocurrido_en datetime [not null]
  procesado_en datetime
}

// ==========================================
// 5. PACIENTES E HISTORIA CLINICA
// ==========================================

Table pacientes {
  id char(36) [pk]
  tipo_documento varchar(30)
  numero_documento varchar(40)
  nombres varchar(150)
  apellidos varchar(150)
  fecha_nacimiento date
  sexo_registrado varchar(30)
  telefono varchar(30)
  direccion varchar(255)
  datos_identificacion_incompletos boolean [not null, default: false]
  creado_en datetime [not null]
  actualizado_en datetime

  indexes {
    (tipo_documento, numero_documento) [unique]
    (apellidos, nombres)
  }
}

Table emergencias_pacientes {
  id char(36) [pk]
  emergencia_id char(36) [not null]
  paciente_id char(36) [not null]
  numero_paciente varchar(40)
  condicion_inicial text
  estado varchar(40) [not null, default: 'pendiente_evaluacion']
  creado_en datetime [not null]

  indexes {
    (emergencia_id, paciente_id) [unique]
  }
}

Table historias_clinicas_prehospitalarias {
  id char(36) [pk]
  numero_historia varchar(50) [unique, not null]
  emergencia_paciente_id char(36) [not null]
  asignacion_servicio_id char(36) [not null]
  fecha_apertura datetime [not null]
  motivo_atencion text [not null]
  enfermedad_actual text
  mecanismo_trauma text
  antecedentes_relevantes text
  alergias_resumen text
  impresion_diagnostica text
  prioridad_triaje varchar(30)
  condicion_inicial text
  condicion_final text
  estado varchar(40) [not null, default: 'borrador']
  creada_por_id char(36) [not null]
  cerrada_por_id char(36)
  fecha_cierre datetime
  actualizada_en datetime

  indexes {
    (emergencia_paciente_id, fecha_apertura)
    (asignacion_servicio_id)
    (estado, fecha_apertura)
  }
}

Table triajes {
  id char(36) [pk]
  historia_clinica_id char(36) [not null]
  clasificacion varchar(40) [not null]
  motivo text
  evaluacion text
  registrado_por_id char(36) [not null]
  evaluado_en datetime [not null]
}

Table valoraciones_clinicas {
  id char(36) [pk]
  historia_clinica_id char(36) [not null]
  tipo_valoracion varchar(50) [not null]
  hallazgos text
  estado_neurologico text
  via_aerea text
  respiracion text
  circulacion text
  examen_fisico text
  impresion_clinica text
  cambios_clinicos text
  registrado_por_id char(36) [not null]
  registrada_en datetime [not null]

  indexes {
    (historia_clinica_id, registrada_en)
  }
}

Table signos_vitales {
  id char(36) [pk]
  historia_clinica_id char(36) [not null]
  valoracion_clinica_id char(36)
  presion_sistolica int
  presion_diastolica int
  frecuencia_cardiaca int
  frecuencia_respiratoria int
  saturacion_oxigeno decimal(5,2)
  temperatura decimal(4,2)
  glucemia decimal(7,2)
  glucemia_unidad varchar(20)
  escala_dolor int
  glasgow int
  oxigeno_suplementario boolean
  observaciones text
  registrado_por_id char(36) [not null]
  medido_en datetime [not null]
  registrado_en datetime [not null]

  indexes {
    (historia_clinica_id, medido_en)
  }
}

Table antecedentes_clinicos {
  id char(36) [pk]
  paciente_id char(36) [not null]
  tipo varchar(60) [not null]
  descripcion text [not null]
  fuente_informacion varchar(60)
  vigente boolean
  registrado_por_id char(36)
  registrado_en datetime [not null]
}

Table alergias_paciente {
  id char(36) [pk]
  paciente_id char(36) [not null]
  sustancia varchar(150)
  reaccion text
  gravedad varchar(40)
  estado_conocimiento varchar(40) [not null, default: 'desconocido']
  fuente_informacion varchar(60)
  registrada_por_id char(36)
  registrada_en datetime [not null]
}

Table medicamentos_administrados {
  id char(36) [pk]
  historia_clinica_id char(36) [not null]
  nombre_medicamento varchar(150) [not null]
  principio_activo varchar(150)
  dosis decimal(12,4)
  unidad_dosis varchar(30)
  via_administracion varchar(60)
  hora_administracion datetime
  estado varchar(40) [not null]
  motivo_no_administracion text
  respuesta_clinica text
  eventos_adversos text
  registrado_por_id char(36) [not null]
  registrado_en datetime [not null]
}

Table procedimientos_prehospitalarios {
  id char(36) [pk]
  historia_clinica_id char(36) [not null]
  tipo_procedimiento varchar(120) [not null]
  indicacion text
  descripcion text
  resultado text
  complicaciones text
  realizado_en datetime
  estado varchar(40) [not null]
  registrado_por_id char(36) [not null]
  registrado_en datetime [not null]
}

Table mecanismos_lesion {
  id char(36) [pk]
  historia_clinica_id char(36) [not null]
  tipo varchar(100) [not null]
  descripcion text
  altura_caida_metros decimal(8,2)
  uso_elementos_proteccion varchar(100)
  registrado_en datetime [not null]
}

Table lesiones_paciente {
  id char(36) [pk]
  historia_clinica_id char(36) [not null]
  region_anatomica varchar(100)
  lateralidad varchar(30)
  tipo_lesion varchar(100)
  descripcion text
  gravedad_aparente varchar(50)
  registrada_en datetime [not null]
  registrado_por_id char(36) [not null]
}

// ==========================================
// 6. INSTITUCIONES, TRASLADOS Y ENTREGAS
// ==========================================

Table instituciones_salud {
  id char(36) [pk]
  nombre varchar(180) [not null]
  nit varchar(30)
  codigo_habilitacion varchar(50)
  telefono varchar(30)
  direccion varchar(255)
  latitud decimal(10,7)
  longitud decimal(10,7)
  activa boolean [not null, default: true]
}

Table destinos_traslado {
  id char(36) [pk]
  historia_clinica_id char(36) [not null]
  institucion_id char(36)
  nombre_destino varchar(180)
  direccion varchar(255)
  motivo_traslado text
  condicion_salida text
  salida_en datetime
  llegada_en datetime
  estado varchar(40) [not null]
  registrado_por_id char(36)
}

Table entregas_paciente {
  id char(36) [pk]
  historia_clinica_id char(36) [not null]
  destino_traslado_id char(36)
  profesional_receptor varchar(150)
  cargo_receptor varchar(100)
  identificacion_receptor varchar(60)
  resumen_entrega text
  condicion_entrega text
  entregado_en datetime [not null]
  constancia_ref varchar(500)
  registrado_por_id char(36) [not null]
}

Table consentimientos_clinicos {
  id char(36) [pk]
  historia_clinica_id char(36) [not null]
  tipo varchar(80) [not null]
  resultado varchar(40) [not null]
  motivo text
  registrado_por_id char(36) [not null]
  registrado_en datetime [not null]
  documento_ref varchar(500)
}

Table firmas_clinicas {
  id char(36) [pk]
  historia_clinica_id char(36) [not null]
  usuario_id char(36) [not null]
  tipo_firma varchar(60) [not null]
  referencia_validacion varchar(255)
  hash_documento varchar(255)
  firmada_en datetime [not null]
  estado varchar(40) [not null]
}

Table documentos_clinicos {
  id char(36) [pk]
  historia_clinica_id char(36) [not null]
  tipo_documento varchar(80) [not null]
  nombre_original varchar(255)
  referencia_almacenamiento varchar(500) [not null]
  tipo_mime varchar(120)
  hash_archivo varchar(255)
  cargado_por_id char(36) [not null]
  cargado_en datetime [not null]
}

// ==========================================
// 7. NOTIFICACIONES E INTEGRACIONES
// ==========================================

Table notificaciones {
  id char(36) [pk]
  usuario_id char(36) [not null]
  tipo varchar(80) [not null]
  titulo varchar(180) [not null]
  mensaje text [not null]
  entidad varchar(100)
  entidad_id char(36)
  leida_en datetime
  creada_en datetime [not null]
}

Table notificaciones_historial {
  id char(36) [pk]
  notificacion_id char(36) [not null]
  canal varchar(40) [not null]
  estado varchar(40) [not null]
  proveedor varchar(100)
  detalle_error text
  intentos int [not null, default: 0]
  enviado_en datetime
  actualizado_en datetime
}

Table integraciones_eventos {
  id char(36) [pk]
  sistema_origen varchar(100) [not null]
  sistema_destino varchar(100)
  evento varchar(120) [not null]
  clave_idempotencia varchar(150)
  payload json
  estado varchar(40) [not null, default: 'pendiente']
  intentos int [not null, default: 0]
  creado_en datetime [not null]
  procesado_en datetime

  indexes {
    (sistema_origen, clave_idempotencia) [unique]
    (estado, creado_en)
  }
}

Table incidentes_sistema {
  id char(36) [pk]
  tipo varchar(100) [not null]
  severidad varchar(30) [not null]
  descripcion text [not null]
  entidad varchar(100)
  entidad_id char(36)
  estado varchar(40) [not null, default: 'abierto']
  reportado_en datetime [not null]
  resuelto_en datetime
}

// ==========================================
// RELACIONES
// ==========================================

// Seguridad
Ref: usuarios_roles.usuario_id > usuarios.id
Ref: usuarios_roles.rol_id > roles.id
Ref: roles_permisos.rol_id > roles.id
Ref: roles_permisos.permiso_id > permisos.id
Ref: sesiones.usuario_id > usuarios.id
Ref: auditoria_eventos.usuario_id > usuarios.id

// Personal y flota
Ref: ambulancias.tipo_ambulancia_id > tipos_ambulancia.id
Ref: personal.usuario_id - usuarios.id
Ref: personal_credenciales.personal_id > personal.id
Ref: tripulaciones_integrantes.tripulacion_id > tripulaciones.id
Ref: tripulaciones_integrantes.personal_id > personal.id
Ref: turnos_operativos.personal_id > personal.id
Ref: turnos_operativos.ambulancia_id > ambulancias.id
Ref: turnos_operativos.tripulacion_id > tripulaciones.id
Ref: estados_ambulancia_historial.ambulancia_id > ambulancias.id
Ref: estados_ambulancia_historial.usuario_id > usuarios.id
Ref: mantenimientos_ambulancias.ambulancia_id > ambulancias.id

// Reportes y emergencias
Ref: reportes_emergencia.fuente_reporte_id > fuentes_reporte.id
Ref: reportes_emergencia.recibido_por_id > usuarios.id
Ref: emergencias.creada_por_id > usuarios.id
Ref: emergencias_reportes.emergencia_id > emergencias.id
Ref: emergencias_reportes.reporte_id > reportes_emergencia.id
Ref: emergencias_reportes.vinculado_por_id > usuarios.id
Ref: emergencias_ubicaciones.emergencia_id > emergencias.id
Ref: emergencias_ubicaciones.registrada_por_id > usuarios.id
Ref: emergencias_historial_estados.emergencia_id > emergencias.id
Ref: emergencias_historial_estados.usuario_id > usuarios.id
Ref: alertas_duplicados.reporte_origen_id > reportes_emergencia.id
Ref: alertas_duplicados.reporte_coincidente_id > reportes_emergencia.id
Ref: alertas_duplicados.emergencia_coincidente_id > emergencias.id
Ref: alertas_duplicados.revisado_por_id > usuarios.id

// Despacho y GPS
Ref: asignaciones_servicio.emergencia_id > emergencias.id
Ref: asignaciones_servicio.ambulancia_id > ambulancias.id
Ref: asignaciones_servicio.tripulacion_id > tripulaciones.id
Ref: asignaciones_servicio.asignada_por_id > usuarios.id
Ref: asignaciones_historial_estados.asignacion_id > asignaciones_servicio.id
Ref: asignaciones_historial_estados.usuario_id > usuarios.id
Ref: ubicaciones_ambulancias.ambulancia_id > ambulancias.id
Ref: ubicaciones_ambulancias.asignacion_id > asignaciones_servicio.id
Ref: servicios_tiempos.asignacion_id > asignaciones_servicio.id
Ref: servicios_tiempos.registrado_por_id > usuarios.id

// Pacientes e historia clínica
Ref: emergencias_pacientes.emergencia_id > emergencias.id
Ref: emergencias_pacientes.paciente_id > pacientes.id
Ref: historias_clinicas_prehospitalarias.emergencia_paciente_id > emergencias_pacientes.id
Ref: historias_clinicas_prehospitalarias.asignacion_servicio_id > asignaciones_servicio.id
Ref: historias_clinicas_prehospitalarias.creada_por_id > usuarios.id
Ref: historias_clinicas_prehospitalarias.cerrada_por_id > usuarios.id
Ref: triajes.historia_clinica_id > historias_clinicas_prehospitalarias.id
Ref: triajes.registrado_por_id > usuarios.id
Ref: valoraciones_clinicas.historia_clinica_id > historias_clinicas_prehospitalarias.id
Ref: valoraciones_clinicas.registrado_por_id > usuarios.id
Ref: signos_vitales.historia_clinica_id > historias_clinicas_prehospitalarias.id
Ref: signos_vitales.valoracion_clinica_id > valoraciones_clinicas.id
Ref: signos_vitales.registrado_por_id > usuarios.id
Ref: antecedentes_clinicos.paciente_id > pacientes.id
Ref: antecedentes_clinicos.registrado_por_id > usuarios.id
Ref: alergias_paciente.paciente_id > pacientes.id
Ref: alergias_paciente.registrada_por_id > usuarios.id
Ref: medicamentos_administrados.historia_clinica_id > historias_clinicas_prehospitalarias.id
Ref: medicamentos_administrados.registrado_por_id > usuarios.id
Ref: procedimientos_prehospitalarios.historia_clinica_id > historias_clinicas_prehospitalarias.id
Ref: procedimientos_prehospitalarios.registrado_por_id > usuarios.id
Ref: mecanismos_lesion.historia_clinica_id > historias_clinicas_prehospitalarias.id
Ref: lesiones_paciente.historia_clinica_id > historias_clinicas_prehospitalarias.id
Ref: lesiones_paciente.registrado_por_id > usuarios.id

// Instituciones, traslado y entrega
Ref: destinos_traslado.historia_clinica_id > historias_clinicas_prehospitalarias.id
Ref: destinos_traslado.institucion_id > instituciones_salud.id
Ref: destinos_traslado.registrado_por_id > usuarios.id
Ref: entregas_paciente.historia_clinica_id > historias_clinicas_prehospitalarias.id
Ref: entregas_paciente.destino_traslado_id > destinos_traslado.id
Ref: entregas_paciente.registrado_por_id > usuarios.id
Ref: consentimientos_clinicos.historia_clinica_id > historias_clinicas_prehospitalarias.id
Ref: consentimientos_clinicos.registrado_por_id > usuarios.id
Ref: firmas_clinicas.historia_clinica_id > historias_clinicas_prehospitalarias.id
Ref: firmas_clinicas.usuario_id > usuarios.id
Ref: documentos_clinicos.historia_clinica_id > historias_clinicas_prehospitalarias.id
Ref: documentos_clinicos.cargado_por_id > usuarios.id

// Notificaciones e integraciones
Ref: notificaciones.usuario_id > usuarios.id
Ref: notificaciones_historial.notificacion_id > notificaciones.id
 