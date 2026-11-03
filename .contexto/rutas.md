# Módulo de rutas (`src/modules/routing`)

> Contexto general en [00-general.md](00-general.md). Guía para frontend y app: `docs/api-rutas-frontend.md`.

## Qué hace

Calcula la **ruta por calles** de cada ambulancia hacia la emergencia que atiende y, durante el traslado, hacia el hospital que eligió el conductor (Geoapify Routing, con la misma `GEOAPIFY_API_KEY`). Ver [ruta-institucion.md](ruta-institucion.md). La guarda en `rutas_asignacion` y la avisa por tiempo real. **El frontend solo la dibuja**; no calcula rutas ni llama al proveedor.

Decisión (2026-10-24): la ruta va en el backend porque así:
- la clave queda en el servidor;
- la web y la app ven la misma ruta y el mismo ETA;
- se controla la cuota (no se recalcula en cada GPS);
- la selección futura de la ambulancia más cercana por tiempo de carretera (`arquitectura.md` §9) necesita esta lógica aquí.

## Endpoints

| Método | Ruta | Roles | Caso de uso |
| --- | --- | --- | --- |
| GET | `/rutas/activas` | admin, despachador | `ConsultarRutasActivas`: la ruta vigente de cada servicio `asignada`, `en_camino` o `trasladando` |
| GET | `/asignaciones/{id}/ruta` | admin, despachador; conductor y paramédico **solo de su turno** | `ObtenerRutaAsignacion` (`404` si no hay ruta **vigente**) |

`/rutas/activas` no se puso en `/asignaciones/rutas` para no chocar con `GET /asignaciones/:id`, que valida que el id sea un UUID.

## Cuándo se calcula (`RecalculadorRutas`, escucha el bus de eventos)

Asignaciones y ubicaciones **no saben que este módulo existe**: el listener se suscribe al bus.

| Evento | Acción |
| --- | --- |
| `asignacion.creada` | Calcular con motivo `despacho`, desde la última posición de la ambulancia **solo si tiene ≤ 10 min** (`ANTIGUEDAD_MAXIMA_ORIGEN_MS`) |
| `asignacion.actualizada` en `trasladando`, con hospital y sin ruta vigente | Calcular con motivo `inicio_traslado` o `cambio_destino`, desde la última posición de ≤ 10 min |
| `ambulancia.ubicacion_actualizada` con servicio y **sin ruta vigente** | Calcular con motivo `sin_ruta` desde esa posición. Si falla, no se reintenta antes de `RUTAS_INTERVALO_RECALCULO_S` (mapa `intentosSinRuta`) |
| `ambulancia.ubicacion_actualizada` con ruta vigente | Si `estaDesviada` (> `RUTAS_DISTANCIA_DESVIO_M`, 150 m) **y** `admiteRecalculo` (≥ 60 s desde el último cálculo) → recalcular con motivo `desvio` desde esa posición. Si no, nada |

La regla de los 10 minutos nace del caso real del 2026-10-24: la última posición guardada era una prueba en Bogotá y la ambulancia estaba en Cúcuta. Con ese origen se habría trazado una ruta de 550 km.

## `CalcularRutaAsignacion`

1. El tramo sale del estado (`tramoDelEstado`): `asignada` y `en_camino` → `hacia_emergencia` (coordenadas de la emergencia); `trasladando` → `hacia_destino` (coordenadas del hospital). Sin tramo o sin coordenadas, no calcula.
2. Proveedores en orden (`ProveedoresRutas`). Una `FallaProveedorExterno` pasa al siguiente; si ninguno responde, devuelve `null`. **Nunca lanza**, porque lo invocan eventos y no una petición HTTP.
3. Vuelve a leer la asignación, descarta el resultado si ya no sirve, guarda una fila nueva en `rutas_asignacion` (**historial**) y publica `asignacion.ruta_actualizada` en el bus. La vigente es la más reciente **si `esVigentePara(asignacion)`**.
4. Deduplicación por asignación, tramo y destino (`ConsultasEnCurso`): el despacho y el primer GPS simultáneos calculan una sola vez, pero un cálculo hacia otro hospital no absorbe el del destino nuevo.

## Dominio

- `RutaAsignacion` (`calcular`, `reconstruir`, `llegadaEstimada`, `estaDesviada`, `admiteRecalculo`). Tramos `hacia_emergencia` y `hacia_destino`; motivos `despacho`, `sin_ruta`, `desvio`, `inicio_traslado` y `cambio_destino`.
- `geometria_ruta.ts` → `distanciaPuntoARuta`: distancia perpendicular al segmento más cercano, con proyección equirrectangular local (sin librerías).
- `proveedor_rutas.ts`: contratos `ProveedorRutas` (`calcular(origen, destino) → { geometria, distanciaMetros, duracionSegundos } | null`) y `ProveedoresRutas`.

## Infraestructura

- `GeoapifyRutasProveedor`: `GET /v1/routing?waypoints=lat,lon|lat,lon&mode=drive&format=json`. Une los tramos de `geometry` (`[[{lat,lon}…]…]`) y toma `distance` (m) y `time` (s).
- `PrismaRutasAsignacionRepositorio`: la geometría va en una columna **JSON** como `[[lon, lat], …]` (orden GeoJSON). `listarVigentes` usa `distinct: ['asignacionId']` con orden descendente.
- `RegistroProveedoresRutas`: orden según `RUTAS_PROVEEDORES`.

## Refactor compartido con geocodificación (mismo día)

- `src/common/integrations/geoapify/cliente_geoapify.ts` (`ClienteGeoapify`): HTTP, validación de la clave, timeout y traducción de errores para todas las APIs de Geoapify. Lo usan el proveedor de geocodificación y el de rutas.
- `src/common/exceptions/falla_proveedor_externo.ts` (`FallaProveedorExterno`). `FallaProveedorGeocodificacion` quedó como alias exportado desde el dominio de geocodificación.
- `ConsultasEnCurso` se movió a `src/common/utils/consultas_en_curso.ts`.

## Tiempo real

- Evento de dominio `asignacion.ruta_actualizada { asignacionId }` en `common/events/eventos_dominio.ts`.
- `NotificadorTiempoReal.rutaActualizada` emite `{ ruta: RutaRespuestaDto }` a `central` + las salas `usuario:{id}` de la tripulación del servicio.
- **El servidor `webSocket/` tiene lista blanca** (`webSocket/src/modules/notifications/domain/eventos.ts → EVENTOS_NEGOCIO`): se agregó `asignacion.ruta_actualizada`. **Todo evento nuevo debe agregarse ahí** o el servidor lo rechaza.

## Tabla `rutas_asignacion`

Migración `20261024234520_rutas_asignacion`.

| Columna | Detalle |
| --- | --- |
| `id` | CHAR(36) |
| `asignacion_id` | FK a `asignaciones_servicio` |
| `tramo`, `motivo` | Ver arriba |
| `origen_latitud`, `origen_longitud` | Dónde estaba la ambulancia al calcular |
| `destino_latitud`, `destino_longitud` | La emergencia o el hospital |
| `geometria` | JSON, `[[lon, lat], …]` |
| `distancia_metros`, `duracion_segundos` | INT |
| `proveedor` | Quién la calculó |
| `calculada_en` | Fecha del cálculo |

Índice por (`asignacion_id`, `calculada_en`).

## Variables

| Variable | Por defecto |
| --- | --- |
| `RUTAS_PROVEEDORES` | `geoapify` |
| `RUTAS_DISTANCIA_DESVIO_M` | `150` |
| `RUTAS_INTERVALO_RECALCULO_S` | `60` |
| `RUTAS_TIEMPO_ESPERA_MS` | `8000` |

Todas son opcionales y están validadas en `variables_entorno.ts`.

## Pruebas (21 nuevas; 155 en total en la API)

- Geometría (4).
- Entidad (3): ETA, desvío, intervalo.
- `CalcularRutaAsignacion` (7):
  - despacho desde una posición reciente;
  - **posición vieja → no calcula**;
  - primer GPS;
  - emergencia sin coordenadas;
  - ya en escena;
  - respaldo y todos fallan;
  - deduplicación.
- `RecalculadorRutas` (6): despacho, sobre la ruta no recalcula, desvío, intervalo mínimo, sin ruta (sin reintentar en cada GPS), ambulancia libre.
- `GeoapifyRutasProveedor` (4): forma real de la respuesta, vacío, 429, sin clave.
- Notificador (+1): la ruta va a la central y solo a su tripulación.

## Prueba real (2026-10-24, Cúcuta)

Escenario aparte: AMB-02, `carlos.conductor@prueba.co` y `lucia.paramedica@prueba.co`, emergencia `EMG-20261024-0007`.

| Paso | Resultado |
| --- | --- |
| Despacho con GPS reciente | `despacho`, 2532 m, ≈ 4 min, 51 puntos |
| `GET /rutas/activas` | `AMB-02 → EMG-20261024-0007` |
| Tripulación propia / ajena | `200` / `403` |
| GPS sobre la ruta | No recalcula |
| GPS a ~1 km de la ruta (pasado el minuto) | `desvio` desde la nueva posición: 3577 m, 126 puntos |
| En escena | La ruta sale de las activas |

**WebSocket:** el evento no llegó en la prueba porque el servidor `webSocket/` corría desde antes del cambio, sin modo watch (`node dist/main`). Hay que reiniciarlo (`npm run start:dev`) para que cargue la lista blanca nueva.

Al final se finalizaron el servicio y el turno de AMB-02.

## Pendiente

- **ETA con tráfico**: Geoapify no usa tráfico en vivo. Si se necesita, agregar Google Routes como proveedor (la arquitectura ya lo soporta).
- **Selección de la ambulancia más cercana por tiempo** (Route Matrix) para sugerir el despacho.
