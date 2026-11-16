# Tiempo real (WebSocket)

> Contexto general en [00-general.md](00-general.md). Escrito el 2026-10-24.

## Decisión

El WebSocket es un **servidor aparte**: el proyecto `../../webSocket` (NestJS + Socket.IO), con su propio README. La API **no** usa Socket.IO. Le entrega cada evento al servidor por **HTTP interno**, protegido con una clave compartida. Sin Redis por ahora: hay una sola instancia.

| Pieza | Dónde | Responsabilidad |
| --- | --- | --- |
| Bus de eventos | `src/common/events/` | Los casos de uso publican hechos ya guardados (`EventoDominio`: tipo + ids) |
| Notificador | `src/modules/notifications/` | Recarga el estado con los casos de uso y DTO del REST y decide **a quién** va cada evento |
| Emisor HTTP | `notifications/infrastructure/services/` | `POST {TIEMPO_REAL_URL}/interno/eventos`, con reintentos |
| Verificación de sesiones | `authentication` → `POST /interno/sesiones/verificar` | El servidor WebSocket pregunta aquí por cada conexión y cada 60 s |
| Conexiones y salas | `webSocket/` | Quién entra a cada sala según el rol, revalidación y deduplicación |

El contrato para los clientes (web y app) está en la sección "Contrato para los clientes" de este archivo: los eventos WebSocket no aparecen en Swagger.

## Flujo

```text
Caso de uso → guarda → audita → PublicadorEventos.publicar({ tipo, ids })
  → BusEventos (setImmediate: nunca demora ni rompe la respuesta HTTP)
  → NotificadorTiempoReal: recarga (ObtenerEmergencia, ObtenerMiServicio, …) y elige las salas
  → EmisorHttpTiempoReal → webSocket/ → clientes
```

- `PublicadorEventos` es un puerto abstracto. Los casos de uso no saben quién escucha y los módulos de negocio no dependen de `notifications`, así que no hay dependencia circular.
- **Se publica solo después de persistir y auditar.** Si la operación falla, no se publica nada; las pruebas lo verifican.
- Una sala por persona (`usuario:{id}`), no por ambulancia: la tripulación cambia con los turnos.

## Puntos de publicación

| Caso de uso | Eventos |
| --- | --- |
| `RegistrarEmergencia` | `emergencia.creada` (el notificador además sugiere `emergencia.posible_duplicado`) |
| `ActualizarEmergencia` | `emergencia.actualizada` con `cambios` = campos enviados |
| `CancelarEmergencia`, `MarcarEmergenciaDuplicada` | `emergencia.actualizada` |
| `CrearAmbulancia`, `ActualizarAmbulancia`, `CambiarEstadoAmbulancia` | `ambulancia.actualizada` |
| `IniciarTurno`, `ReemplazarIntegrantesTurno` | `turno.actualizado` (con integrantes anteriores y nuevos) |
| `FinalizarTurno` | `turno.actualizado` + `ambulancia.actualizada` si estaba disponible |
| `DespacharAmbulancia` | `asignacion.creada` + `ambulancia.actualizada` + `emergencia.actualizada` si cambió su estado |
| `AvanzarAsignacion` | `asignacion.actualizada` (+ ambulancia y emergencia si cambiaron) |
| `CancelarAsignacion` | `asignacion.actualizada` + `ambulancia.actualizada` (+ emergencia si cambió) |
| `ReportarUbicacion` | `ambulancia.ubicacion_actualizada` (máximo 1 cada 3 s por ambulancia: `LimitadorUbicaciones`) |

`mi_servicio.actualizado` (`ObtenerMiServicio`, la misma forma que `GET /mi-servicio`) se envía a cada integrante del turno de la asignación, a las tripulaciones de las asignaciones activas cuando cambia la emergencia, y a los afectados por un cambio de turno.

## Reintentos

- `EmisorHttpTiempoReal` reintenta a 1 s, 3 s y 10 s cuando hay errores de red, 429 o 5xx. Los 4xx no se reintentan, porque son la clave o el contrato.
- El `id` del evento no cambia entre reintentos: `webSocket/` descarta lo que ya entregó.
- Las ubicaciones no se reintentan: la siguiente es más nueva.
- Máximo 500 envíos pendientes. Si se agotan los intentos, solo queda el tipo y el `id` en el log, sin datos.
- Sin outbox: si el proceso cae justo después de guardar, el evento se pierde y los clientes lo recuperan al reconectar, porque reconsultan el REST. Si eso deja de ser aceptable, se evalúa un Transactional Outbox.

## Seguridad

- `TIEMPO_REAL_CLAVE_INTERNA` (mínimo 32 caracteres) se usa en los dos sentidos y viaja en la cabecera `x-clave-interna`. Se compara en tiempo constante.
- `ClaveInternaGuard` (`src/common/guards/`) responde **403**, no 401, para que `webSocket/` no lo confunda con una sesión inválida y no saque al usuario.
- `/interno/sesiones/verificar` es `@Publico()` (no lleva JWT de usuario) y `@SkipThrottle()`, porque todas las solicitudes llegan desde la IP del servidor WebSocket. No aparece en Swagger.
- `VerificarSesionToken` = `VerificadorTokens` (firma, emisor, vencimiento) + `ValidarSesion`: las mismas reglas que `JwtStrategy`. Devuelve solo `{ usuarioId, rol, expiraEn }`.
- Sin `TIEMPO_REAL_URL` o sin la clave, la API arranca igual y lo avisa en el log. Si las variables quedan vacías en el `.env`, cuentan como no configuradas.

## Seguimiento para ciudadanos (2026-11-04)

Evento nuevo `seguimiento.actualizado`, solo a `usuario:{informante}`, desde `NotificadorSeguimientoCiudadano` (ver [ciudadanos.md](ciudadanos.md)).

**Pendiente en el servidor `webSocket/`** (la API ya lo emite):
- aceptar el rol `ciudadano`, con la sala `usuario:{id}` y **nunca** la `central`;
- agregar `seguimiento.actualizado` a la lista blanca de eventos.

Hasta entonces, la API registra `No se entregó seguimiento.actualizado` en su log y la app del ciudadano consulta por REST.

## Contrato para los clientes

**Conexión:** una por app (Socket.IO), con el token de acceso. El servidor responde con uno de estos eventos:

| Evento | Significa | El cliente debe |
| --- | --- | --- |
| `conectado` `{ usuarioId, rol, salas }` | Sesión válida, ya está en sus salas | **Reconsultar el REST**, porque lo ocurrido mientras estaba desconectado no se reenvía |
| `error_autenticacion` `{ mensaje }` | Token inválido o vencido, sesión cerrada, usuario bloqueado o **cambio de rol** | Cerrar la sesión; no reintentar con el mismo token |
| `error_conexion` `{ mensaje }` | Falla temporal | Reintentar con espera progresiva (de 1 s a 30 s) |

**Salas** (las asigna el servidor según el rol):

| Rol | Recibe |
| --- | --- |
| `administrador`, `despachador` | Todo lo de la sala `central` |
| `conductor`, `paramedico` | Solo `mi_servicio.actualizado` de **su** servicio (`usuario:{id}`) |
| `ciudadano` | Solo `seguimiento.actualizado` de **sus** reportes (`usuario:{id}`); nunca la central |

**Eventos.** La forma de cada carga es **la misma del REST**, así que el cliente reutiliza sus tipos.

| Evento | Carga | Cuándo |
| --- | --- | --- |
| `emergencia.creada` | `{ emergencia }` (como `GET /emergencias/{id}`) | Registro |
| `emergencia.actualizada` | `{ emergencia, cambios: string[] }` | Edición, cancelación, duplicada, cambio de estado (`['estado']`) |
| `emergencia.posible_duplicado` | `{ emergenciaId, numeroEmergencia, posibles }` | Al crearla, si hay candidatas: **solo una sugerencia** |
| `asignacion.creada` / `asignacion.actualizada` | `{ asignacion }` (como `GET /asignaciones/{id}`) | Despacho; avance o cancelación |
| `asignacion.ruta_actualizada` | `{ ruta }` (como `GET /asignaciones/{id}/ruta`) | Ruta nueva: despacho, primer GPS o desvío. Llega también a la tripulación |
| `ambulancia.actualizada` | `{ ambulancia }` | Alta, edición, estado, despacho, fin de servicio o de turno |
| `ambulancia.ubicacion_actualizada` | `{ ambulanciaId, asignacionId, latitud, longitud, velocidad, registradaEn }` | GPS, máximo uno cada 3 s por ambulancia |
| `turno.actualizado` | `{ turno }` | Inicio, cambio de integrantes o fin |
| `mi_servicio.actualizado` | La misma forma que `GET /mi-servicio` | Lo descrito en "Puntos de publicación" |
| `seguimiento.actualizado` | `{ seguimiento }` (como `GET /ciudadanos/emergencias/{id}/seguimiento`) | Despacho, movimiento, etapa o ruta. Termina con `disponible: false` |

**Reglas para los clientes:**
- descartar los eventos con un `id` ya visto, o con un `ocurridoEn` anterior al último aplicado para el mismo recurso (un reintento puede llegar tarde);
- mostrar el estado de la conexión;
- desuscribirse al desmontar.

## Pendiente

- Decidir si la tripulación debe ver `informanteNombre` e `informanteTelefono`. Hoy los recibe igual que en `GET /mi-servicio`; si se quitan, hay que hacerlo en los dos.
- Reportes ciudadanos y WhatsApp, y aceptar o rechazar una asignación: no existen todavía, así que no tienen eventos.
