# IMPLEMENTACIÓN DEL MÓDULO CIUDADANO 

## 1. Rol y responsabilidad

Actúa como un ingeniero de software senior especializado en backend, arquitectura de software, seguridad, diseño de API REST, bases de datos y sistemas críticos.

Tu responsabilidad es analizar, diseñar e implementar el módulo ciudadano de la plataforma Ambulancia, integrándolo con la infraestructura y los módulos existentes.

**IMPORTANTE: En esta etapa trabajarás exclusivamente sobre el backend.**

No debes implementar pantallas Flutter, componentes visuales ni modificar el frontend móvil.

Sin embargo, tienes una segunda responsabilidad obligatoria: generar una documentación técnica completa en formato Markdown para que otro agente especializado en Flutter pueda implementar el módulo ciudadano utilizando exactamente los contratos y funcionalidades que hayas desarrollado.

No trabajes con suposiciones cuando puedas inspeccionar el código existente.

No inventes endpoints, tablas, servicios, relaciones ni funcionalidades que no hayas verificado.

---

# 2. Contexto general del proyecto

La plataforma Ambulancia está compuesta por varios repositorios independientes:

- `ambulancia`: repositorio principal.
- `ambulancia-back`: API y lógica de negocio.
- `ambulancia-app`: aplicación móvil Flutter.
- `ambulancia-ws`: servicio de comunicación WebSocket.
- `ambulancia-front`: frontend administrativo.

La aplicación Flutter es universal y actualmente tiene dos tipos de usuarios operativos:

1. Conductores de ambulancia.
2. Paramédicos.

Se incorporará un tercer tipo de usuario:

3. Ciudadanos.

Los ciudadanos podrán consultar un mapa y reportar emergencias desde la misma aplicación Flutter.

**No se debe desarrollar una aplicación independiente para ciudadanos.**

La experiencia y los permisos deben depender del rol autenticado.

## Principio fundamental

El módulo ciudadano debe integrarse sin alterar el funcionamiento actual de conductores, paramédicos, ambulancias, servicios asignados, atención de pacientes, geolocalización ni comunicación en tiempo real.

La implementación debe ser compatible con el sistema actual.

Antes de modificar cualquier componente, comprende sus dependencias.

---

# 3. Primera etapa: auditoría obligatoria del backend

Antes de escribir código, inspecciona exhaustivamente el repositorio `ambulancia-back`.

Debes identificar:

- Lenguaje y framework.
- Arquitectura utilizada.
- Estructura de carpetas.
- Sistema de autenticación.
- Sistema de autorización y roles.
- Middleware y guards.
- Entidades y modelos.
- Relaciones entre tablas.
- Migraciones existentes.
- Convenciones de nombres.
- Validaciones.
- Manejo de errores.
- Servicios y casos de uso.
- Repositorios y acceso a datos.
- Sistema de almacenamiento de archivos.
- Servicio de geolocalización.
- Integración con WebSocket.
- Sistema de notificaciones.
- Gestión de emergencias existente.
- Integración con el módulo de ambulancias.
- Sistema administrativo existente para gestionar usuarios.

Revisa especialmente los módulos relacionados con:

- Usuarios.
- Roles.
- Emergencias.
- Ambulancias.
- Servicios.
- Conductores.
- Paramédicos.
- Geolocalización.
- Asignaciones.
- Notificaciones.

Examina también el esquema real de la base de datos y sus restricciones.

No crees una segunda implementación de funcionalidades que ya existan.

### Restricciones

- No reemplazar el sistema de autenticación.
- No duplicar entidades existentes.
- No eliminar funcionalidades.
- No cambiar contratos existentes sin justificación.
- No modificar tablas operativas sin analizar sus dependencias.
- No realizar migraciones destructivas.
- No introducir dependencias innecesarias.
- No crear endpoints duplicados.
- No utilizar `any` si el proyecto utiliza TypeScript.
- Mantener los patrones arquitectónicos existentes.

Si detectas problemas estructurales, documenta los hallazgos y propone una solución compatible.

Una vez realizada la auditoría, continúa con la implementación.

---

# 4. Nuevo rol: ciudadano

El sistema debe incorporar un rol de ciudadano.

Los roles existentes de conductor y paramédico deben conservar sus funcionalidades.

El ciudadano tendrá acceso exclusivamente a las funcionalidades autorizadas para su rol.

## Funcionalidades del ciudadano

1. Registro de cuenta.
2. Verificación de identidad mediante documento.
3. Inicio de sesión.
4. Consulta de mapa.
5. Obtención de ubicación GPS.
6. Reporte de emergencias.
7. Consulta de sus reportes.
8. Consulta y actualización de su perfil.

No debe tener acceso a:

- Gestión de ambulancias.
- Asignación de servicios.
- Atención de pacientes.
- Gestión de turnos.
- Funcionalidades administrativas.
- Información de otros ciudadanos.
- Información privada de otros reportes.

La autorización debe aplicarse en el backend, no solamente en Flutter.

---

# 5. Registro de ciudadanos

El ciudadano debe poder crear una cuenta desde la aplicación Flutter.

La tabla existente es:

### Tabla: usuarios

Columnas actuales:

- id: CHAR(36), PK.
- rol_id: CHAR(36).
- nombres: VARCHAR(100).
- apellidos: VARCHAR(100).
- tipo_documento: VARCHAR(30).
- numero_documento: VARCHAR(40).
- correo: VARCHAR(150).
- telefono: VARCHAR(30).
- registro_profesional: VARCHAR(60).
- contrasena_hash: VARCHAR(255).
- estado: VARCHAR(30).
- ultimo_acceso: DATETIME(3).
- creado_en: DATETIME(3).

Esta tabla debe reutilizarse.

No crees una tabla independiente de ciudadanos si el modelo actual permite representar correctamente este rol.

## Información requerida

El registro ciudadano debe solicitar:

| Campo | Obligatorio |
|---|---|
| Nombres | Sí |
| Apellidos | Sí |
| Tipo de documento | Sí |
| Número de documento | Sí |
| Fecha de nacimiento | Sí |
| Teléfono | Sí |
| Correo electrónico | Sí |
| Contraseña | Sí |
| Fotografía frontal de cédula | Sí |
| Fotografía posterior de cédula | Definir según política de verificación |

La fecha de nacimiento deberá almacenarse como DATE.

El número de documento debe tener restricciones de unicidad adecuadas y normalización para evitar duplicados.

El correo también debe mantener las restricciones de unicidad que correspondan al sistema actual.

No exigir registro profesional a los ciudadanos.

## Reglas de registro

- Asignar automáticamente el rol ciudadano desde el backend.
- Nunca confiar en un `rol_id` enviado libremente por Flutter.
- No permitir que el ciudadano se registre como administrador, conductor o paramédico.
- Validar los campos en el backend.
- Validar formatos y tamaños de archivos.
- Evitar registros duplicados.
- Aplicar las reglas de contraseña existentes o fortalecerlas si es necesario.
- No devolver contraseñas ni hashes en las respuestas.
- No exponer rutas públicas de documentos.
- Utilizar almacenamiento privado para los archivos.

La cuenta debe crearse inicialmente con estado de verificación pendiente.

---

# 6. Verificación documental de identidad

**La verificación biométrica facial queda completamente fuera del alcance de esta primera versión.**

No implementar:

- Reconocimiento facial.
- Prueba de vida.
- Comparación biométrica.
- Captura biométrica.
- Integraciones con proveedores biométricos.

La verificación se realizará mediante la fotografía del documento de identidad.

## Responsable de verificación

Por el momento, exclusivamente un administrador autorizado podrá revisar los documentos y aprobar o rechazar una cuenta.

No debe existir aprobación automática.

## Estados de verificación

Utiliza estados normalizados:

- `pendiente`
- `en_revision`
- `verificado`
- `rechazado`
- `requiere_correccion`

Adapta estos valores a las convenciones actuales si ya existe un catálogo de estados.

## Flujo de verificación

1. Ciudadano crea su cuenta.
2. Carga los documentos solicitados.
3. Backend almacena los documentos de forma privada.
4. Cuenta queda en estado `pendiente`.
5. Administrador consulta solicitudes pendientes.
6. Administrador accede a la información y documentos mediante autorización.
7. Administrador revisa la información.
8. Puede aprobar, rechazar o solicitar correcciones.
9. El backend registra quién realizó la revisión y cuándo.
10. Si se aprueba, la cuenta pasa a `verificado`.

Si se rechaza o solicita corrección, el ciudadano debe poder conocer el motivo sin exponer información administrativa sensible.

## Seguridad documental

Los documentos de identidad contienen información personal.

Por tanto:

- Utilizar almacenamiento privado.
- No almacenar archivos en directorios públicos.
- Evitar URL permanentes de acceso público.
- Proporcionar endpoints protegidos para consultar documentos.
- Validar permisos del administrador.
- Registrar auditoría de consultas y modificaciones.
- Limitar formatos permitidos.
- Validar MIME real, extensión y tamaño.
- Generar nombres internos seguros.
- Evitar que el nombre original del archivo controle la ruta.
- Evitar almacenar documentos en logs.
- Definir políticas de conservación y eliminación.

No asumir que cargar una fotografía equivale a validar oficialmente la autenticidad de una cédula.

La aprobación administrativa constituye una revisión documental interna, no una certificación oficial de identidad.

---

# 7. Restricción estricta de acceso por verificación

Esta es una regla crítica del sistema.

**Un ciudadano cuya cuenta no esté verificada NO podrá reportar emergencias.**

No implementar excepciones en esta primera versión.

Los siguientes estados no permiten reportar:

- pendiente.
- en_revision.
- rechazado.
- requiere_correccion.

Únicamente el estado `verificado` permite utilizar la funcionalidad de reportar emergencias.

Esta validación debe ejecutarse en el backend en cada solicitud de creación de emergencia.

No basta con ocultar el botón en Flutter.

Si un usuario pendiente intenta utilizar directamente el endpoint, debe recibir una respuesta controlada indicando que su identidad no ha sido verificada.

El ciudadano podrá:

- Iniciar sesión.
- Consultar su perfil.
- Consultar el estado de su verificación.
- Corregir sus documentos cuando corresponda.
- Consultar información pública y general de la aplicación.

Pero no podrá generar reportes de emergencia.

La aplicación debe comunicar claramente que, para emergencias que requieran atención inmediata, debe utilizar los canales oficiales de atención, incluido el 123 cuando corresponda.

---

# 8. Gestión administrativa de verificaciones

Implementa la funcionalidad backend necesaria para que un administrador autorizado pueda:

- Consultar solicitudes pendientes.
- Consultar solicitudes en revisión.
- Consultar información de un ciudadano.
- Consultar documentos de identidad.
- Aprobar una solicitud.
- Rechazar una solicitud.
- Solicitar correcciones.
- Consultar el historial de revisiones.

Cada decisión debe registrar:

- Usuario administrador responsable.
- Usuario ciudadano revisado.
- Estado anterior.
- Estado nuevo.
- Motivo de la decisión, cuando corresponda.
- Fecha y hora.
- Observaciones administrativas.

Las acciones deben estar protegidas por autorización administrativa.

Un ciudadano no puede modificar su propio estado de verificación.

Un conductor o paramédico tampoco puede aprobar documentos.

Evita que la actualización del estado pueda realizarse mediante endpoints genéricos de edición del perfil.

---

# 9. Módulo ciudadano: mapa y geolocalización

El ciudadano tendrá un mapa en la aplicación Flutter.

El backend debe aprovechar los servicios de geolocalización existentes.

Actualmente existe un servicio en el backend que permite obtener direcciones mediante geolocalización.

Debes localizarlo, comprender su funcionamiento y reutilizarlo.

No implementar otro servicio de geocodificación si ya existe uno funcional.

## Funcionalidades esperadas

- Recibir coordenadas de latitud y longitud.
- Consultar la dirección correspondiente.
- Obtener información geográfica.
- Permitir utilizar coordenadas manuales cuando sea necesario.
- Normalizar las respuestas para Flutter.

El dispositivo móvil será responsable de solicitar permisos GPS y obtener las coordenadas actuales.

El backend recibirá las coordenadas y utilizará el servicio existente para obtener la dirección.

No asumir que el GPS siempre estará disponible.

Si el ciudadano no tiene GPS disponible, deberá existir una alternativa de ubicación manual desde el mapa.

La API debe permitir identificar cuándo una ubicación fue obtenida por GPS y cuándo fue ingresada manualmente.

No confiar ciegamente en las coordenadas recibidas del dispositivo.

Validar:

- Rango de latitud.
- Rango de longitud.
- Precisión de decimales.
- Coordenadas nulas.
- Valores fuera de rango.

---

# 10. Módulo de reporte de emergencias

La tabla existente es:

### Tabla: emergencias

Columnas:

- id: CHAR(36), PK.
- numero_emergencia: VARCHAR(40).
- fuente: VARCHAR(40).
- informante_nombre: VARCHAR(150).
- informante_telefono: VARCHAR(30).
- descripcion: TEXT.
- tipo_incidente: VARCHAR(60).
- prioridad: VARCHAR(30).
- direccion: VARCHAR(255).
- referencia_lugar: VARCHAR(255).
- latitud: DECIMAL(10,7).
- longitud: DECIMAL(10,7).
- numero_victimas: INT.
- estado: VARCHAR(40).
- emergencia_principal_id: CHAR(36).
- recibida_por_id: CHAR(36).
- recibida_en: DATETIME(3).
- cerrada_en: DATETIME(3).

Reutiliza esta tabla.

Antes de modificarla, inspecciona sus relaciones y todos los módulos que la utilizan.

No alteres el funcionamiento de las emergencias generadas desde otros canales.

## Relación con usuarios

La emergencia generada por un ciudadano debe quedar vinculada a su cuenta.

Si no existe una relación equivalente, incorpora:

`informante_usuario_id CHAR(36)`

Debe existir una relación adecuada con `usuarios.id`.

Esto permitirá consultar los reportes de cada ciudadano sin depender exclusivamente del nombre o teléfono.

## Información del reporte

El reporte debe contemplar:

- Usuario autenticado.
- Nombre del informante.
- Teléfono de contacto.
- Tipo de incidente.
- Descripción.
- Prioridad, determinada según las reglas del sistema o por el operador.
- Dirección.
- Referencia del lugar.
- Latitud.
- Longitud.
- Número aproximado de víctimas.
- Fuente del reporte.
- Estado.
- Fecha de creación.

La información personal del informante debe provenir del usuario autenticado.

No permitir que Flutter suplante a otro informante enviando un identificador de usuario diferente.

## Tipos iniciales de incidente

Considera inicialmente:

- Accidente de tránsito.
- Emergencia médica.
- Persona lesionada.
- Quemaduras.
- Emergencia obstétrica.
- Otro incidente.

Revisa si ya existe un catálogo de tipos de incidentes.

Si existe, reutilízalo.

No dupliques catálogos.

El tipo de incidente debe validarse en el backend.

## Descripción

La descripción debe permitir al ciudadano explicar brevemente qué sucede.

Implementa límites razonables de longitud y validación.

## Número de víctimas

Debe aceptar un número entero positivo.

No permitir valores negativos, decimales ni valores fuera del límite razonable definido por el negocio.

## Ubicación

La ubicación debe incluir:

- Latitud.
- Longitud.
- Dirección obtenida mediante el servicio de geolocalización.
- Referencia adicional del lugar.
- Origen de las coordenadas: GPS o manual.

Si es necesario, incorpora una columna para identificar el origen de la ubicación.

No inventar una dirección cuando el servicio de geolocalización no pueda resolverla.

Permitir que el ciudadano aporte una referencia manual.

---

# 11. Ciclo de vida de una emergencia ciudadana

El ciudadano puede reportar una emergencia, pero NO puede ordenar directamente el despacho de una ambulancia.

**Todo reporte ciudadano debe ser revisado por un operador de la central antes de iniciar el despacho.**

Flujo:

1. Ciudadano autenticado y verificado.
2. Envía reporte.
3. Backend valida los datos.
4. Backend registra la emergencia.
5. Se genera un número único de emergencia.
6. La emergencia queda disponible para la central.
7. El operador recibe una notificación.
8. El operador revisa la información.
9. El operador puede contactar al informante.
10. El operador determina la prioridad.
11. El operador valida el reporte.
12. El operador gestiona el despacho.
13. Se asigna una ambulancia utilizando el flujo operativo existente.

No crear un segundo sistema de asignación de ambulancias.

La asignación debe reutilizar el mecanismo existente.

## Estados propuestos

Revisa los estados actuales y adapta la siguiente propuesta:

- `recibida`
- `en_revision`
- `pendiente_informacion`
- `validada`
- `despachada`
- `en_atencion`
- `finalizada`
- `cancelada`
- `descartada`

El backend debe controlar las transiciones permitidas.

No permitir que el ciudadano cambie arbitrariamente el estado de su emergencia.

Tampoco permitir que el ciudadano establezca libremente una prioridad médica.

La prioridad debe ser determinada por el operador según el procedimiento operativo establecido.

## Importante: no despachar automáticamente

No implementar:

- Asignación automática de ambulancias por reporte ciudadano.
- Selección de ambulancia desde el módulo ciudadano.
- Asignación directa al conductor por parte del ciudadano.
- Cambios de estado operativos desde la aplicación ciudadana.

El sistema debe garantizar que un reporte recién recibido no se interprete como una ambulancia despachada.

---

# 12. Prevención de abuso y reportes duplicados

El sistema debe incorporar mecanismos para reducir reportes falsos y duplicados.

Implementa y documenta:

- Validación de identidad verificada.
- Registro de usuario informante.
- Control de frecuencia de solicitudes.
- Protección frente a solicitudes repetidas.
- Detección de reportes potencialmente duplicados.
- Registro de IP y metadatos técnicos cuando sea legal y necesario.
- Auditoría de eventos relevantes.

La detección de duplicados debe considerar, cuando sea posible:

- Usuario informante.
- Proximidad geográfica.
- Tipo de incidente.
- Ventana temporal.
- Estado de reportes existentes.

No descartar automáticamente un reporte por parecer duplicado.

Debe marcarse para revisión del operador.

No implementar un límite rígido de tres reportes por usuario.

Una persona puede necesitar reportar diferentes emergencias reales.

Los mecanismos de prevención no deben bloquear injustificadamente solicitudes legítimas.

## Idempotencia

Evalúa implementar una clave de idempotencia para evitar que una misma solicitud se registre varias veces por problemas de conectividad o reintentos de Flutter.

Documenta cómo debe utilizarse.

---

# 13. Mis reportes: historial del ciudadano

El ciudadano podrá consultar únicamente las emergencias que haya generado.

No implementar un módulo de estadísticas complejo.

La funcionalidad debe incluir:

- Listado paginado.
- Número de emergencia.
- Fecha y hora.
- Tipo de incidente.
- Dirección.
- Estado actual.
- Detalle del reporte.

El detalle no debe exponer datos internos de la central ni información de terceros.

El ciudadano no podrá consultar reportes ajenos, incluso si conoce su número de emergencia.

Implementar filtros sencillos por fecha o estado si son compatibles con la arquitectura existente.

---

# 14. Perfil del ciudadano

El ciudadano podrá consultar:

- Nombres.
- Apellidos.
- Tipo de documento.
- Número de documento, con exposición controlada.
- Fecha de nacimiento.
- Correo.
- Teléfono.
- Estado de verificación.
- Fecha de registro.

Permitirá actualizar los campos personales que el negocio autorice.

No permitir modificar:

- Rol.
- Estado de verificación.
- Identificador interno.
- Número de emergencia.
- Datos administrativos.
- Historial de revisiones.

Los cambios de documento de identidad deben requerir un procedimiento especial de revisión.

No permitir que un usuario cambie su documento y conserve automáticamente la verificación anterior.

---

# 15. Seguridad y protección de datos

Esta plataforma manejará información personal de ciudadanos y datos relacionados con situaciones de emergencia.

Debes implementar seguridad desde el diseño.

Considera la normativa colombiana aplicable, especialmente:

- Ley 1581 de 2012.
- Decreto 1074 de 2015.
- Normativa complementaria aplicable al tratamiento de datos personales.

No asumir cumplimiento legal automático por implementar controles técnicos.

Documenta las consideraciones que requieren revisión jurídica.

## Controles técnicos

- Autenticación segura.
- Autorización por rol.
- Validación en backend.
- Cifrado en tránsito.
- Protección de contraseñas.
- Protección de documentos.
- Restricción de acceso a archivos.
- Rate limiting.
- Protección contra fuerza bruta.
- Validación de entradas.
- Prevención de IDOR.
- Protección frente a escalamiento de privilegios.
- Auditoría.
- Manejo seguro de errores.
- Protección de información sensible en logs.

No registrar contraseñas, documentos completos, tokens ni fotografías en los logs.

No devolver información sensible innecesaria.

Implementar políticas de retención de documentos y registros.

---

# 16. WebSocket y notificaciones

Inspecciona el repositorio `ambulancia-ws` y el mecanismo actual de comunicación entre backend, central, conductores y paramédicos.

Si existe un mecanismo adecuado, reutilízalo.

Cuando un ciudadano genere una emergencia:

- La central debe poder recibir una notificación en tiempo real.
- El evento debe incluir el identificador de emergencia.
- Debe incluir el número de emergencia.
- Debe incluir los datos operativos necesarios.
- Debe respetar los permisos de los destinatarios.

No transmitir documentos de identidad, contraseñas ni información sensible innecesaria por WebSocket.

La notificación en tiempo real no debe ser la única fuente de verdad.

La emergencia debe quedar almacenada en la base de datos antes de emitir el evento.

Debe existir una estrategia para recuperar reportes cuando se pierda la conexión.

Si el sistema utiliza un patrón de eventos o colas, respeta el mecanismo existente.

No implementes una segunda infraestructura de notificaciones sin necesidad.

---

# 17. Diseño de API y contratos para Flutter

Todos los endpoints nuevos deben tener contratos claros y consistentes.

Respeta el formato de respuesta existente.

Si el proyecto utiliza DTOs, validadores, serializadores o documentación Swagger, mantén sus convenciones.

Los endpoints deben cubrir como mínimo:

### Autenticación y registro

- Registro ciudadano.
- Inicio de sesión, reutilizando el mecanismo existente.
- Consulta de perfil.
- Consulta de estado de verificación.
- Actualización de perfil.

### Documentos

- Carga de documento frontal.
- Carga de documento posterior, si se implementa.
- Consulta del estado de revisión.
- Reemplazo de documentos cuando se solicite corrección.

### Administración

- Listado de verificaciones pendientes.
- Consulta de detalle de verificación.
- Acceso protegido a documentos.
- Aprobar ciudadano.
- Rechazar ciudadano.
- Solicitar correcciones.

### Geolocalización

- Resolución de dirección por coordenadas, reutilizando el servicio existente.

### Emergencias

- Crear reporte ciudadano.
- Consultar mis reportes.
- Consultar detalle de un reporte propio.
- Consultar estado de un reporte.

No crear un endpoint para que el ciudadano pueda asignar ambulancias.

No crear un endpoint para que el ciudadano pueda cambiar la prioridad o el estado operativo.

## Documentación obligatoria de cada endpoint

Cada endpoint debe documentar:

- Método HTTP.
- Ruta.
- Autenticación requerida.
- Roles autorizados.
- Parámetros.
- Body.
- Campos obligatorios.
- Validaciones.
- Respuesta exitosa.
- Errores posibles.
- Códigos HTTP.
- Ejemplo de petición.
- Ejemplo de respuesta.

Incluye ejemplos JSON reales y consistentes con la implementación.

No documentes contratos que no existan.

---

# 18. Integridad y consistencia de datos

Revisa las restricciones existentes antes de introducir nuevas.

Evalúa:

- Índices.
- Claves foráneas.
- Unicidad de documentos.
- Unicidad de correos.
- Integridad de estados.
- Relaciones entre usuarios y emergencias.
- Transacciones de registro.
- Transacciones de revisión documental.
- Generación de números de emergencia.
- Concurrencia.
- Auditoría.

La generación de números de emergencia debe ser segura frente a solicitudes simultáneas.

No generar identificadores secuenciales de forma insegura mediante un simple COUNT de registros.

Si el registro requiere múltiples operaciones, utilizar transacciones.

Evitar estados parcialmente creados.

---

# 19. Pruebas obligatorias

Implementa pruebas automatizadas siguiendo las herramientas existentes.

Como mínimo, cubrir:

## Registro

- Registro ciudadano exitoso.
- Registro duplicado.
- Correo duplicado.
- Documento duplicado.
- Datos incompletos.
- Archivo inválido.
- Archivo demasiado grande.
- Intento de asignarse un rol administrativo.

## Verificación

- Ciudadano pendiente no puede reportar.
- Ciudadano en revisión no puede reportar.
- Ciudadano rechazado no puede reportar.
- Ciudadano que requiere corrección no puede reportar.
- Ciudadano verificado sí puede reportar.
- Ciudadano no puede aprobarse a sí mismo.
- Conductor no puede aprobar ciudadanos.
- Paramédico no puede aprobar ciudadanos.
- Administrador autorizado puede revisar y aprobar.

## Emergencias

- Creación correcta.
- Ubicación válida.
- Coordenadas inválidas.
- Usuario no autenticado.
- Usuario no verificado.
- Intento de suplantar informante.
- Reporte duplicado.
- Solicitudes repetidas.
- Número de víctimas inválido.
- Tipo de incidente inválido.
- Error de geolocalización.
- Reporte creado sin conexión WebSocket.
- Usuario no puede consultar emergencias ajenas.
- Ciudadano no puede modificar prioridad.
- Ciudadano no puede asignar ambulancia.

## Seguridad

- Intento de acceso a documentos de otro usuario.
- Intento de modificar rol.
- Intento de modificar estado de verificación.
- Intento de acceder a endpoints administrativos.
- Intento de escalamiento de privilegios.
- Protección de información sensible.

No basta con probar respuestas exitosas. Los escenarios negativos son especialmente importantes.

---

# 20. Documentación obligatoria para el agente Flutter

Esta es una de las responsabilidades más importantes de esta tarea.

Al terminar la implementación, debes crear un documento Markdown independiente destinado al agente que desarrollará el frontend Flutter.

Ubicación propuesta:

`ambulancia-back/docs/INTEGRACION_MODULO_CIUDADANO_FLUTTER.md`

Si el proyecto tiene una convención documental diferente, respétala y documenta la ubicación final.

Este documento debe permitir que un agente Flutter implemente el módulo ciudadano sin tener que inspeccionar el backend para adivinar cómo funciona.

## Contenido obligatorio

### A. Contexto del módulo

- Objetivo.
- Roles.
- Permisos.
- Restricciones.
- Flujo de autenticación.

### B. Registro

- Campos.
- Tipos.
- Validaciones.
- Archivos permitidos.
- Límites de tamaño.
- Formatos.
- Ejemplo JSON.
- Respuestas.
- Errores.

### C. Verificación

- Estados.
- Qué significa cada estado.
- Qué pantallas debe mostrar Flutter según el estado.
- Qué acciones están permitidas.
- Qué acciones están bloqueadas.
- Cómo cargar documentos nuevamente.
- Cómo interpretar motivos de rechazo o corrección.

### D. Autenticación

- Endpoints.
- Formato de tokens.
- Renovación de sesión, si existe.
- Roles.
- Respuesta de perfil.
- Manejo de sesiones expiradas.

### E. Mapa y GPS

- Endpoint de geolocalización.
- Parámetros.
- Formato de coordenadas.
- Respuesta de dirección.
- Comportamiento ante errores.
- Ubicación manual.
- Diferencias entre ubicación GPS y manual.

### F. Reportar emergencia

- Endpoint.
- Campos.
- Validaciones.
- Tipos de incidente.
- Ejemplos de petición.
- Respuesta.
- Errores.
- Idempotencia.
- Comportamiento de la aplicación tras el envío.

### G. Mis reportes

- Listado.
- Paginación.
- Detalle.
- Estados.
- Filtros.
- Ejemplos.

### H. WebSocket

- URL o configuración existente.
- Autenticación.
- Eventos.
- Payloads.
- Suscripciones.
- Reconexión.
- Recuperación de información.
- Restricciones de seguridad.

### I. Manejo de errores

Define claramente qué debe hacer Flutter ante:

- 400.
- 401.
- 403.
- 404.
- 409.
- 413.
- 422.
- 429.
- 500.

Adapta estos códigos al comportamiento real de la API.

### J. Flujos de navegación

Documenta los flujos:

1. Registro.
2. Inicio de sesión.
3. Verificación pendiente.
4. Verificación aprobada.
5. Verificación rechazada.
6. Corrección de documentos.
7. Consulta del mapa.
8. Creación de emergencia.
9. Consulta de reportes.
10. Sesión expirada.

### K. Ejemplos completos

Incluye ejemplos reales de:

- Registro.
- Inicio de sesión.
- Consulta de perfil.
- Carga de documentos.
- Creación de emergencia.
- Consulta de reportes.
- Consulta de detalle.
- Respuestas de errores.
- Eventos WebSocket.

**Todos los ejemplos deben corresponder al código implementado.**

No inventes respuestas hipotéticas que contradigan los DTOs reales.

### L. Configuración

- URL base.
- Headers.
- Autenticación.
- Multipart.
- Formatos de fechas.
- Paginación.
- Manejo de archivos.
- Variables de entorno necesarias.

No incluir secretos ni credenciales reales.

---

# 21. Documentación interna y contexto para futuros agentes

Además del documento de integración Flutter, actualiza la documentación interna del backend.

Debes mantener:

- Arquitectura.
- Decisiones técnicas.
- Modelo de datos.
- Migraciones.
- Endpoints.
- Permisos.
- Estados.
- Reglas de negocio.
- Consideraciones de seguridad.
- Pruebas.

Utiliza los directorios `.contexto` y `.reglas` si ya existen en el proyecto.

No dupliques documentación existente innecesariamente.

Si existe documentación desactualizada, actualízala.

---

# 22. Estrategia de implementación

No intentes implementar todo de manera desordenada.

Divide el trabajo en etapas:

**Fase 1. Auditoría**
- Comprender backend.
- Comprender base de datos.
- Comprender módulos existentes.
- Identificar reutilización.

**Fase 2. Modelo de datos**
- Rol ciudadano.
- Fecha de nacimiento.
- Verificación.
- Documentos.
- Relación con emergencias.
- Auditoría.

**Fase 3. Registro y verificación**
- Registro.
- Carga privada de documentos.
- Consulta de estado.
- Gestión administrativa.
- Aprobación y rechazo.

**Fase 4. Funcionalidad ciudadana**
- Perfil.
- Geolocalización.
- Reportes.
- Historial.

**Fase 5. Integración operativa**
- Notificaciones a central.
- WebSocket.
- Integración con emergencias.
- Reutilización del despacho existente.

**Fase 6. Seguridad y pruebas**
- Autorización.
- Validaciones.
- Pruebas negativas.
- Auditoría.
- Prevención de abuso.

**Fase 7. Documentación Flutter**
- Generar contratos.
- Ejemplos.
- Flujos.
- Estados.
- Errores.
- Configuración.

---

# 23. Condiciones que NO debes incumplir

1. No implementar Flutter.
2. No reemplazar la arquitectura actual.
3. No modificar innecesariamente módulos operativos.
4. No implementar biometría facial en esta versión.
5. No permitir reportes a ciudadanos no verificados.
6. No permitir que ciudadanos aprueben su identidad.
7. No permitir que ciudadanos despachen ambulancias.
8. No permitir prioridad médica definida libremente por el ciudadano.
9. No permitir acceso a reportes ajenos.
10. No almacenar documentos públicamente.
11. No duplicar servicios de geolocalización.
12. No duplicar el sistema de asignación de ambulancias.
13. No inventar endpoints.
14. No dejar documentación incompleta.
15. No considerar terminada la tarea hasta generar el documento de integración Flutter.

---

# 24. Entregables finales

Al terminar debes presentar:

1. Auditoría del estado inicial del backend.
2. Resumen de arquitectura y decisiones tomadas.
3. Archivos creados y modificados.
4. Migraciones implementadas.
5. Endpoints nuevos y modificados.
6. Reglas de autorización.
7. Funcionalidades implementadas.
8. Pruebas ejecutadas y resultados.
9. Problemas encontrados y pendientes.
10. Consideraciones de seguridad.
11. Documento `INTEGRACION_MODULO_CIUDADANO_FLUTTER.md`.
12. Instrucciones para ejecutar migraciones y pruebas.
13. Variables de entorno nuevas, si las hubiera.

Incluye explícitamente qué quedó implementado, qué quedó pendiente y qué no pudo verificarse.

No afirmes que una funcionalidad está terminada si solamente existe su estructura.

---

# 25. Criterio de finalización

El trabajo estará completo cuando:

- El ciudadano pueda registrarse.
- El documento pueda cargarse de manera segura.
- El administrador pueda revisar y aprobar la identidad.
- Los usuarios no verificados no puedan reportar.
- Los usuarios verificados puedan consultar el mapa.
- El ciudadano pueda reportar una emergencia.
- La central pueda recibir el reporte.
- El despacho siga dependiendo del operador.
- El ciudadano pueda consultar sus propios reportes.
- Las funcionalidades existentes de conductor y paramédico sigan funcionando.
- Las pruebas automatizadas estén ejecutadas.
- La documentación para Flutter esté completa y corresponda exactamente a la implementación.

**Prioridad absoluta: seguridad, compatibilidad con el sistema existente, integridad de datos y claridad de los contratos de integración.**

Antes de finalizar, revisa nuevamente todos los cambios y asegúrate de que no hayas introducido regresiones en los módulos operativos existentes.

Comienza con la auditoría del backend y continúa hasta completar los entregables.