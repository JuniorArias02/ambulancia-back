# Módulo de ciudadanos (`src/modules/citizens`)

> Contexto general en [00-general.md](00-general.md). Guía para Flutter: `docs/INTEGRACION_MODULO_CIUDADANO_FLUTTER.md`.
> Implementado y verificado el 2026-11-02. Especificación de origen: `docs/implementacion_ciudadano.md`.

## Qué hace

1. **Registro público** del ciudadano, con las dos fotos del documento.
2. **Verificación documental** por un administrador: aprobar, rechazar o pedir corrección. No hay biometría ni aprobación automática.
3. **Reporte de emergencias**, solo con la identidad `verificado`.
4. Consulta de sus propios reportes y de su perfil.

**No despacha ni elige ambulancias, ni define prioridad o estado.** El reporte queda `recibida` y la central lo gestiona con el flujo existente.

## Auditoría inicial (resumen de hallazgos)

| Tema | Hallazgo | Decisión |
| --- | --- | --- |
| Usuarios | La tabla `usuarios` ya tenía `tipo_documento` y `numero_documento` (único), sin fecha de nacimiento | Se reutiliza; se agrega `fecha_nacimiento DATE` |
| Roles | `RolesGuard` deja pasar a cualquier autenticado si el endpoint no tiene `@RequiereRoles` | Se revisaron todos los controladores: solo `perfil` y `cerrar-sesion` de autenticación están abiertos. El ciudadano no accede a nada interno |
| Gestión de usuarios | El administrador podía crear o asignar cualquier rol | Nuevo `ROLES_INTERNOS`: el rol ciudadano no se crea (`400`) ni se asigna o retira (`400` / `422`) desde `/usuarios` |
| Emergencias | Numeración por consecutivo diario + única + reintentos, sin `COUNT`. Ya existían la detección de duplicados y el evento `emergencia.creada` | Se reutiliza `RegistrarEmergencia` |
| Catálogo de incidentes | `accidente_transito`, `caida`, `arma`, `quemadura`, `clinico`, `otro`, también usado en la web | Se reutiliza sin cambios (ver Pendientes) |
| Geocodificación | Existe `POST /geocodificacion/inversa`, con caché y proveedores | Se abre al rol ciudadano; el reporte la usa en el servidor para la dirección |
| Archivos | No había almacenamiento | Puerto `AlmacenamientoDocumentos` + disco privado. `multer` ya venía con `@nestjs/platform-express`: no se instaló nada |
| Tiempo real | El servidor `webSocket/` valida el rol con su propia lista: **rechaza al ciudadano** | Sin cambios: el ciudadano no usa WebSocket en v1. La central recibe el evento existente |

## Modelo de datos

Migración `20261103025936_modulo_ciudadano`. **Solo aditiva:**

- `usuarios.fecha_nacimiento DATE NULL`.
- `emergencias.informante_usuario_id` (FK a usuarios) y `emergencias.origen_ubicacion` (`gps` | `manual`), con índice `(informante_usuario_id, recibida_en)`.
- **`verificaciones_identidad`:** una por ciudadano (`usuario_id` único). Columnas: `estado`, `motivo` (visible al ciudadano), `enviada_en`, `revisada_por_id`, `revisada_en`.
- **`documentos_identidad`:** `lado`, `clave_almacenamiento` (única, generada por el backend), `tipo_mime`, `tamano_bytes`, `huella_sha256`, `vigente`, `cargado_en`, `reemplazado_en`.
- **`historial_verificaciones`:** `estado_anterior`, `estado_nuevo`, `motivo`, `observaciones` (internas), `responsable_id`, `ocurrido_en`.
- `INSERT` del rol `ciudadano` en `roles` si no existe. El seed también lo sincroniza.

**Por qué tablas aparte y no una columna en `usuarios`:** el estado de la cuenta (`activo` / `bloqueado`) y el de la verificación son independientes. Un ciudadano pendiente debe poder iniciar sesión. Además, el historial y los documentos necesitan sus propias filas.

## Endpoints

| Método | Ruta | Acceso | Caso de uso |
| --- | --- | --- | --- |
| POST | `/ciudadanos/registro` | Público, multipart, 5 cada 15 min por IP | `RegistrarCiudadano` |
| POST | `/ciudadanos/acceso` | Público, 10 cada 15 min por IP | `ConsultarAccesoCiudadano`: `{ registrado, siguientePaso }` |
| POST | `/autenticacion/iniciar-sesion-ciudadano` | Público, 5 por minuto | `IniciarSesion.ejecutarConDocumento` (módulo de autenticación) |
| GET | `/ciudadanos/perfil` | ciudadano | `ObtenerCiudadano` |
| PATCH | `/ciudadanos/perfil` | ciudadano | `ActualizarContactoCiudadano` (correo, teléfono) |
| PUT | `/ciudadanos/verificacion` | ciudadano, multipart | `ReenviarVerificacion` (solo en `requiere_correccion`) |
| POST | `/ciudadanos/emergencias` | ciudadano verificado, 5 por minuto | `ReportarEmergenciaCiudadana` |
| GET | `/ciudadanos/emergencias` | ciudadano | `ConsultarMisEmergencias.listar` |
| GET | `/ciudadanos/emergencias/{id}` | ciudadano | `ConsultarMisEmergencias.obtener` (`404` si no es suyo) |
| GET | `/verificaciones-ciudadanos` | administrador | `ConsultarVerificaciones` |
| GET | `/verificaciones-ciudadanos/{usuarioId}` | administrador (auditado) | `ObtenerVerificacion` |
| GET | `/verificaciones-ciudadanos/{usuarioId}/documentos/{documentoId}` | administrador (auditado) | `ObtenerDocumentoIdentidad` |
| POST | `/verificaciones-ciudadanos/{usuarioId}/decision` | administrador | `DecidirVerificacion` |
| POST | `/geocodificacion/inversa` | **+ ciudadano** | Ya existía |

El login es el de siempre (`POST /autenticacion/iniciar-sesion`), que devuelve `rol: "ciudadano"`.

## Acceso con cédula (2026-11-02)

Flujo de la app: cédula → si tiene cuenta, contraseña; si no, registro.

- **`POST /ciudadanos/acceso`:** responde solo `registrado` y `siguientePaso`. Busca **solo cuentas de ciudadanos** (`existeCiudadanoConDocumento`): la cédula de alguien del personal da `false`.
- **Riesgo aceptado (decisión del usuario):** permite enumerar qué cédulas tienen cuenta, en contra de la recomendación de `arquitectura.md` §7. Mitigaciones: límite de 10 consultas cada 15 min por IP (comprobado: la 11.ª da `429`), sin datos personales en la respuesta y por `POST`, así el documento no queda en URLs ni en logs.
- **`POST /autenticacion/iniciar-sesion-ciudadano`:** mismo caso de uso del login (`IniciarSesion`) con un método `ejecutarConDocumento`. Conserva el hash ficticio contra diferencias de tiempo, la sesión, la auditoría y el `401` genérico. El personal sigue entrando con correo.
- **Normalización:** `common/utils/documento_identidad.ts` (`normalizarNumeroDocumento`), compartida con `Ciudadano.normalizarDocumento`.
- **Pruebas:** 8 unitarias nuevas (293 en total) y 17 comprobaciones HTTP reales sobre una copia temporal de la BD. Guía para Flutter: `docs/ACCESO_CEDULA_CIUDADANO_FLUTTER.md`.

## Estados de verificación (`VerificacionIdentidad`)

```
pendiente ──► en_revision ──► verificado        (final)
    │              ├────────► rechazado         (final, con motivo)
    │              └────────► requiere_correccion (con motivo)
    └── (también directo a verificado, rechazado o requiere_correccion)
requiere_correccion ──(el ciudadano reenvía)──► pendiente
```

- **Solo `verificado` permite reportar.** Se revisa en el backend en cada `POST /ciudadanos/emergencias` (`403` con mensaje que menciona la línea 123).
- `rechazado` es final en v1: no se reabre.
- El revisor no puede ser el propio ciudadano (`403`). Además, el endpoint solo es para administradores.
- Concurrencia: `updateMany … where estado = anterior`. Si otro administrador decidió antes, `409`.
- Los datos de identidad solo cambian dentro de un reenvío por corrección (`Ciudadano.corregirIdentidad`). Así nadie cambia su documento y conserva la verificación.

## Registro

- **Orden:** valida la identidad (normaliza el documento, edad ≥ 18 con el día de Colombia, fecha real) → revisa duplicados (`409` genérico, igual para correo y documento) → valida **todas** las fotos → guarda las fotos → transacción en la BD (usuario + verificación + documentos + historial). Si la BD falla, borra las fotos guardadas.
- **Documentos aceptados:** `CC`, `CE`, `PPT`, `PEP` o `PA`. Sin menores de edad: la Ley 1581 da un tratamiento especial a los datos de menores.
- **Contraseña:** la política existente (`POLITICA_CONTRASENA`: 10–128 caracteres, al menos una letra y un número), con Argon2id (`HashContrasena`).
- **El rol lo pone el repositorio** (`rol: { connect: { nombre: 'ciudadano' } }`). Un campo `rol` en el formulario responde `400` (`forbidNonWhitelisted`).

## Archivos

- **Validación (`domain/services/archivo_documento.ts`):** JPG o PNG, de 5 KB a 5 MB. Deben coincidir el MIME declarado, la extensión y la **firma real de bytes**: un PDF renombrado a `.jpg` responde `422`.
- **Límites de multer:** máximo 5 MB por archivo (`413`), 2 archivos y solo los campos `documentoFrontal` y `documentoPosterior` (otro campo de archivo → `400`).
- **`AlmacenamientoSistemaArchivos`:** carpeta `ALMACENAMIENTO_PRIVADO_RUTA/documentos_identidad`, con directorio `0700` y archivos `0600`. El nombre es un UUID generado por el backend y validado con un patrón (sin recorrido de rutas). Usa `flag: 'wx'`, así que nunca sobrescribe. La carpeta está en `.gitignore`, nunca se sirve por HTTP y no se guarda el nombre original.
- **Descarga:** solo el administrador, con `StreamableFile`, `Content-Type` real y `inline`. El documento debe pertenecer al `usuarioId` de la ruta (`404` si no). Queda auditado.
- **Reemplazos:** quedan con `vigente = false` y el archivo se conserva (ver Pendientes de retención).

## Reportes de emergencia

`ReportarEmergenciaCiudadana`:

1. Ciudadano verificado; si no, `403`.
2. **Idempotencia:** el `id` (UUID) lo genera la app. Si ya existe y es del mismo ciudadano, devuelve el mismo reporte con `200` y `creado: false`. Si es de otro, `409`. Si dos envíos simultáneos chocan, el segundo devuelve el primero.
3. **Dirección:** la resuelve el servidor con `GeocodificarCoordenadas`. Si no se encuentra o el proveedor falla, queda en `null` y nunca se inventa. Errores inesperados no se ocultan.
4. **Registro:** `RegistrarEmergencia` con `fuente: 'app'`, informante (nombre y teléfono) de la cuenta, `informanteUsuarioId`, `prioridad: null` y `origenUbicacion`, y la opción `recibidaPorCentral: false`: `recibida_por_id` queda vacío hasta que un operador la gestione.
5. **Aviso:** evento `emergencia.creada`, que ya existía. Va a la sala `central` con `EmergenciaRespuestaDto`, que ahora suma `informanteUsuarioId` y `origenUbicacion`. La emergencia se guarda **antes** de publicar el evento. Si el WebSocket no está, el reporte igual queda y la central lo ve en `GET /emergencias`.

Respuesta al ciudadano (`ReporteCiudadanoRespuestaDto`): sin prioridad, sin receptor y sin `emergenciaPrincipalId`. Solo `unidoAOtroReporte: boolean`, para no exponer otros reportes.

Estados: los mismos de emergencias (`recibida`, `despachada`, `en_atencion`, `cerrada`, `cancelada`). No se agregaron los propuestos en la especificación (`en_revision`, `validada`, etc.) porque cambiarían el ciclo de despacho y la web. La revisión del operador ocurre mientras el reporte está `recibida`.

## Prevención de abuso

| Mecanismo | Detalle |
| --- | --- |
| Identidad verificada | Requisito en cada reporte |
| Informante | La cuenta, nunca un dato del cliente |
| Límites de frecuencia | Registro: 5 cada 15 min por IP. Reenvío: 10 cada 15 min. Reporte: 5 por minuto. No hay tope total por usuario |
| Idempotencia | `id` de la app |
| Duplicados | Detección existente (proximidad, tiempo, tipo) al crear la emergencia: la central recibe `emergencia.posible_duplicado`. Nunca se descarta un reporte solo |
| IP | Se guarda en la auditoría (`direccionIp`) |
| Bloqueo | El administrador puede bloquear la cuenta con `PATCH /usuarios/{id}/estado`, que existía |

## Auditoría

| Entidad | Acción | Detalle |
| --- | --- | --- |
| `usuarios` | `registrar_ciudadano` | `verificacionId` (sin datos personales) |
| `usuarios` | `actualizar_contacto` | `campos` |
| `verificaciones_identidad` | `reenviar` | `camposCorregidos`, `ladosReemplazados` |
| `verificaciones_identidad` | `consultar` | — (cada lectura del detalle) |
| `verificaciones_identidad` | `decidir` | `ciudadanoId`, `estadoAnterior`, `estadoNuevo`, `motivo` |
| `documentos_identidad` | `consultar` | `ciudadanoId`, `lado` (cada descarga) |
| `emergencias` | `crear` | Existía; ahora suma `fuente` |

Nunca se guardan en la auditoría ni en los logs el número de documento, las fotos, contraseñas ni tokens. Comprobado en la prueba real.

## Pruebas

- **Unitarias, 51 nuevas (285 en total):**
  - entidades `VerificacionIdentidad` y `Ciudadano`;
  - validación de archivos;
  - casos de uso de registro, verificación, corrección, documentos, contacto y reportes;
  - los cuatro estados no verificados, idempotencia, id ajeno, geocodificación caída, reportes ajenos.
- **Dobles:** `citizens/test/dobles/ciudadanos_memoria.ts`. `test/dobles/emergencias_memoria.ts` ahora aplica el filtro por informante.
- **Prueba HTTP real** sobre una copia temporal de la BD, ya eliminada. 84 comprobaciones:
  - multipart real, `413`, `400` por campos extra (`rol`, `prioridad`, `estado`, `informanteUsuarioId`), archivo inesperado, PDF renombrado;
  - permisos: conductor, paramédico y ciudadano sin acceso administrativo; el ciudadano sin acceso a emergencias de la central, asignaciones, `mi-servicio` ni usuarios;
  - flujo completo de corrección y aprobación;
  - permisos `0600` de los archivos;
  - evento a la central sin datos sensibles;
  - regresión de conductor, paramédico y central;
  - auditoría sin el número de documento.

## Pendientes y decisiones abiertas

1. **Retención de documentos:** hoy se conservan todos, incluidos los reemplazados y los de cuentas rechazadas. Falta definir el plazo y el borrado con asesoría jurídica (Ley 1581 de 2012, Decreto 1074 de 2015, principio de necesidad).
2. **Autorización de tratamiento de datos (Ley 1581):** el backend no registra la aceptación de la política de privacidad. Debería agregarse el consentimiento con su versión y fecha antes de producción. Requiere revisión jurídica.
3. **Catálogo de incidentes:** la especificación sugería "emergencia obstétrica" y "persona lesionada". Se reutilizó el catálogo existente para no duplicar ni romper la web. Agregar valores es una decisión de negocio que también afecta al frontend.
4. **Cambio de documento de un ciudadano ya verificado:** no hay flujo. Hoy solo el administrador puede editar nombres por `/usuarios`; el documento no se cambia.
5. **Tiempo real para el ciudadano:** el servidor `webSocket/` lo rechaza por rol. Para avisarle cambios de su reporte habría que agregar el rol allí y un evento nuevo. En v1, la app consulta por REST.
6. **Lista de usuarios en la web:** `GET /usuarios` ahora incluye ciudadanos (rol `ciudadano`). La web debe conocer ese rol y no ofrecerlo en sus formularios.
7. **Pantallas web del administrador** para revisar verificaciones: el backend está listo, pero la web no las tiene todavía.
8. **Límite de inicio de sesión:** 5 por minuto por IP, como ya existía. Varios ciudadanos detrás de la misma IP de un operador móvil podrían toparse con él.
9. **Antivirus o reprocesado de imágenes:** solo se valida la firma; no se recodifica la imagen ni se eliminan los metadatos EXIF (que pueden traer ubicación). Conviene evaluarlo.
10. **Copias de respaldo:** la carpeta privada debe incluirse en los respaldos y protegerse igual que la BD.
