# App móvil — inicio del paramédico (guía para Flutter)

**Para:** el equipo de la app de la tripulación (`ambulancia/app`).
**Complementa a:** [`api-app-movil.md`](api-app-movil.md) (login, sesión, `/mi-servicio`) y [`api-ciclo-atencion-app.md`](api-ciclo-atencion-app.md) (pasos del servicio).

**Todo lo que necesita esta entrega ya existe en el backend**, y el rol `paramedico` tiene acceso.

> **Actualizado (2026-10-25): la historia clínica ya existe en el backend.** Para conectar la pantalla de HC, ver **[`api-historia-clinica-app.md`](api-historia-clinica-app.md)**. La sección 5 de esta guía queda como referencia de la estructura.

---

> **Cambio (2026-11-01):** el paramédico selecciona su ambulancia desde la app. Ver [`instrucciones-agente-flutter.md`](instrucciones-agente-flutter.md).

## 1. Navegación según el rol

Al iniciar sesión (o al abrir la app con una sesión guardada), decida el inicio con `usuario.rol` de la respuesta del login o de `GET /autenticacion/perfil`:

| `rol` | Inicio |
| --- | --- |
| `conductor` | Vista actual: mapa, ruta y navegación |
| `paramedico` | **Inicio del paramédico** (este documento): tarjeta de la emergencia asignada → HC |
| `administrador`, `despachador` | No entran a la app (ya documentado) |

- Si el rol no corresponde a ninguna vista, cierre la sesión.
- Un usuario con rol `paramedico` puede ir en el turno con la función `paramedico` o `medico` (`turno.integrantes[].funcion`). Las dos usan esta misma vista; la función se puede mostrar como etiqueta ("Médico").

---

## 2. Endpoints que consume el paramédico

| Para qué | Endpoint | Ya existe |
| --- | --- | --- |
| Iniciar sesión, sesión guardada, salir | `POST /autenticacion/iniciar-sesion`, `GET /autenticacion/perfil`, `POST /autenticacion/cerrar-sesion` | ✅ |
| **Tarjeta de la emergencia asignada** | **`GET /mi-servicio`** | ✅ |
| "Llega en ≈ 4 min" en la tarjeta (opcional) | `GET /asignaciones/{id}/ruta` | ✅ |
| Marcar los pasos que le tocan (atención, traslado, cierre) | `PATCH /asignaciones/{id}/avance` | ✅ |
| Horas del servicio (despacho, llegada…) | `GET /asignaciones/{id}/eventos` | ✅ |
| Hospital de destino, del más cercano al más lejano | `GET /instituciones-salud?activa=true&latitud=…&longitud=…` | ✅ (por ahora solo para mostrar; guardar el destino llegará con la HC) |
| Aviso en tiempo real de un servicio nuevo, un cambio o una cancelación | WebSocket, evento `mi_servicio.actualizado` | ✅ (`api-tiempo-real-frontend.md` §6) |
| Historia clínica | `/historias-clinicas` (ver `api-historia-clinica-app.md`) | ✅ |

El paramédico **no** usa el mapa de navegación, **no** confirma la llegada (eso es del conductor) y **no** necesita enviar GPS: lo envía el celular del conductor. Si igual se envía desde los dos, no hay problema.

---

## 3. Pantalla de inicio del paramédico

### Datos: `GET /mi-servicio`

La misma respuesta que usa el conductor (detalle completo en `api-app-movil.md` §6):

```json
{
  "radioLlegadaMetros": 100,
  "turno": { "ambulanciaCodigo": "AMB-02", "integrantes": [ { "nombreCompleto": "Carlos Pérez", "funcion": "conductor" }, { "nombreCompleto": "Lucía Rojas", "funcion": "paramedico" } ], "…": "…" },
  "asignacion": { "id": "uuid", "numeroEmergencia": "EMG-20261025-0001", "estado": "en_camino", "siguientesEstados": ["en_escena"], "…": "…" },
  "emergencia": { "id": "uuid", "descripcion": "Choque de motos…", "tipoIncidente": "accidente_transito", "prioridad": "roja", "direccion": "Av. Libertadores", "referenciaLugar": "Frente a la estación", "numeroVictimas": 2, "informanteNombre": "Carlos Ruiz", "informanteTelefono": "+57 300…", "recibidaEn": "…", "…": "…" }
}
```

### Los tres estados de la pantalla

| `turno` | `asignacion` | Qué mostrar |
| --- | --- | --- |
| `null` | `null` | "No está en un turno activo." |
| con datos | `null` | "En turno en **AMB-02** con Carlos Pérez (conductor). Sin emergencia asignada." Espera |
| con datos | con datos | **Tarjeta de la emergencia** (abajo) |

### La tarjeta de la emergencia

Contenido sugerido, de arriba hacia abajo:

1. **Franja de prioridad** con color: `roja` = Crítica, `amarilla` = Urgente, `verde` = No urgente, `null` = Sin clasificar (gris).
2. **Tipo de incidente** + **número de víctimas**: "Accidente de tránsito · 2 víctimas".
3. **Descripción** (lo que contó el informante), hasta 3 líneas.
4. **Dirección** + referencia del lugar.
5. **Etapa del servicio**, con el texto de `asignacion.estado`: En camino / En la escena / Atendiendo al paciente / Paciente a bordo.
6. Opcional: "Llega en ≈ 4 min", con `duracionSegundos` de `GET /asignaciones/{id}/ruta`. Solo en `asignada` y `en_camino`; si responde `404`, no lo muestre.
7. **Botón "Llamar al informante"** si viene `informanteTelefono`.
8. **Número de emergencia** pequeño: `EMG-20261025-0001`.

**Al tocar la tarjeta** → se abre la pantalla de **Historia clínica** (sección 5) con `emergencia.id` y `asignacion.id`.

### Botones de los pasos que le tocan al paramédico

Pinte los botones con `asignacion.siguientesEstados` (detalle en `api-ciclo-atencion-app.md`):

| `siguientesEstados` | Botones para el paramédico |
| --- | --- |
| `["en_camino"]` | "Salimos" (puede marcarlo él o el conductor) |
| `["en_escena"]` | **Ninguno**: "Esperando que el conductor confirme la llegada" |
| `["atendiendo", "finalizada"]` | **"Iniciar atención"** · *Finalizar sin traslado* (con motivo) |
| `["trasladando", "finalizada"]` | **"Paciente a bordo"** · *Finalizar sin traslado* (con motivo) |
| `["finalizada"]` | **"Paciente entregado"** |

Al iniciar la atención (`atendiendo`), lo natural es abrir la HC.

### Mantener la tarjeta al día

- Con WebSocket: al recibir `mi_servicio.actualizado`, reemplace todo el estado con `datos` (misma forma de `/mi-servicio`).
- Sin WebSocket: pida `GET /mi-servicio` al abrir, al volver a primer plano y cada 15 s con la pantalla visible.
- Si llega `asignacion: null` después de tener una, avise: "El servicio terminó o fue cancelado por la central".

---

## 4. Configuraciones recomendadas para el paramédico

| Configuración | Recomendación |
| --- | --- |
| Pantalla encendida | Mantener encendida solo mientras la HC esté abierta (`wakelock_plus`), no en el inicio |
| GPS | No es necesario pedirlo al paramédico (lo envía el conductor). Pídalo solo si más adelante se usa para el hospital más cercano |
| Notificación de servicio nuevo | Sonido y vibración al recibir `mi_servicio.actualizado` con una asignación nueva |
| Modo sin señal | Mostrar los últimos datos de `/mi-servicio` guardados en local, con la etiqueta "Sin conexión" |
| Tamaño de letra | Grande y con alto contraste: se usa en movimiento, con guantes y a pleno sol |
| Cerrar sesión | Siempre visible en el menú: los celulares pueden ser compartidos entre turnos |

---

## 5. Pantalla de historia clínica (vacía por ahora)

**El backend todavía no tiene endpoints de HC.** Haga solo la estructura visual con secciones vacías o deshabilitadas ("Próximamente") y un encabezado con los datos que ya tiene de `/mi-servicio`.

Para que la estructura coincida con lo que vendrá, estas son las secciones que tendrá la HC (salen de la tabla `historias_clinicas` y sus tablas relacionadas, ya creadas en la base de datos):

| Sección | Contenido que tendrá |
| --- | --- |
| Encabezado | Número de emergencia, ambulancia, prioridad, dirección (ya disponibles en `/mi-servicio`) |
| 1. Paciente | Identificado o NN, nombres, apellidos, documento, sexo, edad aproximada, EPS, acompañante |
| 2. Evento | Hora, tipo de evento, mecanismo de la lesión, rol de la víctima, elementos de protección, placa del vehículo, SOAT |
| 3. Valoración XABCDE | Hemorragia masiva, vía aérea, respiración, circulación, neurológico, exposición, **triage** |
| 4. Signos vitales | Lista con hora: presión, frecuencia cardíaca y respiratoria, SpO₂, temperatura, glucometría, Glasgow (ocular, verbal, motor), dolor |
| 5. Lesiones | Región del cuerpo, tipo, descripción |
| 6. Intervenciones | Procedimientos y medicamentos: tipo, nombre, dosis, vía, hora, resultado |
| 7. Antecedentes | Alergias, medicamentos habituales, antecedentes |
| 8. Impresión y desenlace | Impresión diagnóstica, observaciones, desenlace (traslado, rechazo…) |
| 9. Entrega | Hospital de destino, condición de entrega, quién recibe (nombre y cargo), hora |

Sugerencia visual: una lista de secciones (acordeón o pasos), cada una con su estado (vacía / en progreso / completa), un botón "Agregar signos vitales" y un botón final "Cerrar HC" deshabilitado.

Las tablas ya contemplan el registro **por voz** (escucha continua desde el celular) y el trabajo **sin señal** (el id de la HC se genera en el celular). Lo documentaremos cuando exista el módulo; por ahora no hay que implementar nada de eso.

---

## 6. Resumen

| Pantalla | Consume |
| --- | --- |
| Login y redirección por rol | `POST /autenticacion/iniciar-sesion` (`usuario.rol`) |
| Inicio del paramédico (tarjeta) | `GET /mi-servicio` (+ opcional `GET /asignaciones/{id}/ruta` para el ETA) |
| Botones de atención, traslado y cierre | `PATCH /asignaciones/{id}/avance` |
| Tiempo real | WebSocket `mi_servicio.actualizado` |
| Historia clínica | `api-historia-clinica-app.md` |
