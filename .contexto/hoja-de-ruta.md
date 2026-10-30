# Hoja de ruta — backend para web y app móvil (Flutter)

> Contexto general en [00-general.md](00-general.md). Escrito el 2026-10-24.

## Las dos apps

| App | Quién la usa | Para qué |
| --- | --- | --- |
| **Web** | `administrador`, `despachador` | Gestionar usuarios y ambulancias, recibir emergencias, despachar y ver el mapa en vivo |
| **Móvil (Flutter)** | Solo `conductor` y `paramedico` (la tripulación) | Ver en el mapa la emergencia asignada, trazar la ruta, marcar el avance del servicio y, los paramédicos, llenar la historia clínica |

**Prioridad acordada:** primero terminar el backend que necesita la web.

## ¿El backend ya aguanta la app Flutter?

> **Actualización 2026-10-24: sí, para empezar.** Turnos, asignaciones (con `GET /mi-servicio` y el avance) y GPS ya están hechos. Falta la historia clínica, que no bloquea el inicio. Lo de abajo es el análisis original.

### Análisis original → Todavía no

### Lo que ya sirve para la app

- **Login, perfil y cerrar sesión** (`/autenticacion/*`): conductores y paramédicos ya pueden iniciar sesión.
- La respuesta del login trae el `rol`, así que la app puede **dejar entrar solo a `conductor` y `paramedico`** y rechazar a los demás (control del lado de la app).
- Las emergencias ya guardan **coordenadas**. **La ruta la traza la app** (Google Maps, Mapbox u OSRM) desde la posición del celular hasta esas coordenadas; el backend no la calcula.

### Lo que falta para la app

| Falta | Por qué la app lo necesita |
| --- | --- |
| **Turnos** (`turnos`, `turnos_integrantes`) | Saber qué conductor y qué paramédico van en cuál ambulancia hoy. Sin esto, el backend no sabe qué emergencia mostrarle a cada usuario |
| **Asignaciones** (`asignaciones_servicio`) | El despachador manda la ambulancia a la emergencia. La app necesita: **`GET /mi-servicio`**, con la emergencia asignada (coordenadas, dirección, descripción, prioridad), y un endpoint para **marcar el avance**: `en_camino` → `en_escena` → `trasladando` → `finalizada` |
| **Permisos** | Hoy `/emergencias` solo deja entrar a `administrador` y `despachador`, y la tripulación recibe `403`. La tripulación debe ver **su** emergencia a través de la asignación, no el listado completo |
| **Ubicación GPS** (`ubicaciones_ambulancias` + columnas `ultima_*` de `ambulancias`) | Que el celular envíe su posición cada cierto tiempo y el despachador vea la ambulancia moverse en el mapa web. Validar que quien reporta pertenece al turno de esa ambulancia |
| **Historia clínica** (`historias_clinicas`, `signos_vitales`, `lesiones`, `intervenciones`, `instituciones_salud`) | La llenan los paramédicos: paciente, signos vitales, lesiones, intervenciones e institución de destino. Las tablas ya existen, pero no tienen módulo |
| **Aviso de nueva asignación** (opcional al inicio) | WebSocket o notificación push (FCM). Para empezar, la app puede consultar `GET /mi-servicio` cada 10–15 segundos |

## Orden de trabajo

Turnos y asignaciones los necesitan **las dos apps**, así que avanzan la web y el móvil al mismo tiempo.

| # | Módulo | Web | Móvil | Estado |
| --- | --- | --- | --- | --- |
| 0 | Auditoría, usuarios, autenticación, ambulancias, emergencias | ✅ | login ✅ | ✅ Hecho |
| 1 | **Turnos** | Armar la tripulación de cada ambulancia; solo pasa a `disponible` con turno activo | El backend sabe a qué ambulancia pertenece cada usuario | ✅ Hecho |
| 2 | **Asignaciones** | El despachador despacha una ambulancia `disponible` a una emergencia `recibida` | `GET /mi-servicio` y marcar el avance | ✅ Hecho |
| 3 | **GPS** | Mapa en vivo de las ambulancias | El celular envía su posición | ✅ Hecho |
| 3b | **Instituciones de salud** | CRUD (administrador) | Elegir el destino del traslado por cercanía | ✅ Hecho |
| 4 | **Historia clínica** | Consulta (administrador) | La llenan los paramédicos | ✅ Hecho (manual; la voz queda pendiente) |
| 5 | **Tiempo real** (WebSocket) | Emergencias nuevas y movimiento de las ambulancias | Aviso de nueva asignación | ✅ Hecho |

> Tiempo real: servidor aparte en `../../webSocket` con un puente HTTP interno desde la API. Detalle en [tiempo-real.md](tiempo-real.md) y contrato para los clientes en `docs/api-tiempo-real-frontend.md`.

**Con los pasos 1 y 2 terminados ya pueden empezar la app Flutter**: login, ver la emergencia asignada en el mapa, trazar la ruta y marcar el avance. La historia clínica (paso 4) se agrega después sin bloquear nada.

## Cambios de estado que traerán las asignaciones

| Acción | Asignación | Emergencia | Ambulancia |
| --- | --- | --- | --- |
| Despachar | `asignada` | `recibida` → `despachada` | `disponible` → `en_servicio` |
| Sale hacia el sitio | `en_camino` | — | — |
| Llega al sitio | `en_escena` | `despachada` → `en_atencion` | — |
| Traslada al paciente | `trasladando` | — | — |
| Finaliza | `finalizada` | `en_atencion` → `cerrada` | `en_servicio` → `disponible` |
| Cancela | `cancelada` (con `motivo_cancelacion`) | según el caso | `en_servicio` → `disponible` |

Cada paso guarda su fecha en `asignaciones_servicio` (`salida_en`, `llegada_escena_en`, `salida_escena_en`, `llegada_destino_en`, `finalizada_en`).

En las entidades hay que agregar métodos distintos de los manuales:
- `Ambulancia`: `iniciarServicio()` y `finalizarServicio()`.
- `Emergencia`: `despachar()`, `iniciarAtencion()` y `cerrar()`.

Además, hay que controlar la concurrencia para que **una misma ambulancia no quede asignada a dos emergencias** (arquitectura.md).

## Lo que necesita la app Flutter del backend (resumen)

| Endpoint (propuesto) | Para qué |
| --- | --- |
| `POST /autenticacion/iniciar-sesion` ✅ | Login (la app filtra por rol) |
| `GET /autenticacion/perfil` ✅ | Usuario actual al reabrir la app |
| `GET /mi-servicio` ✅ | Turno, asignación activa y emergencia con sus coordenadas |
| `PATCH /asignaciones/{id}/avance` ✅ | Marcar `en_camino`, `en_escena`, `trasladando` y `finalizada` |
| `POST /ubicaciones` ✅ | Enviar la posición GPS |
| `GET /instituciones-salud?latitud=&longitud=` ✅ | Instituciones de destino, de la más cercana a la más lejana |
| `POST /historias-clinicas` y relacionados | Historia clínica (paramédicos) |
