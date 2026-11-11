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

Contrato para los clientes: [`docs/api-tiempo-real-frontend.md`](../docs/api-tiempo-real-frontend.md).

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

Evento nuevo `seguimiento.actualizado`, solo a `usuario:{informante}`, desde `NotificadorSeguimientoCiudadano`. El servidor `webSocket/` todavía debe aceptar el rol `ciudadano` y el evento: ver `docs/WEBSOCKET_SEGUIMIENTO_CIUDADANO.md` y [ciudadanos.md](ciudadanos.md).

## Pendiente

- Decidir si la tripulación debe ver `informanteNombre` e `informanteTelefono`. Hoy los recibe igual que en `GET /mi-servicio`; si se quitan, hay que hacerlo en los dos.
- Reportes ciudadanos y WhatsApp, y aceptar o rechazar una asignación: no existen todavía, así que no tienen eventos.
