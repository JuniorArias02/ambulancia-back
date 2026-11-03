# Módulo de geocodificación (`src/modules/geocoding`)

> Contexto general en [00-general.md](00-general.md). Guía para frontend: `docs/api-geocodificacion-frontend.md`.

## Qué hace

Convierte una dirección en coordenadas (**directa**) y un punto del mapa en dirección (**inversa**), usando proveedores externos. **Geoapify** es el primero y, por ahora, el único. Cada resultado se guarda (en `direcciones_geocodificadas` y `geocodificaciones_inversas`) para no volver a consumir la API.

## Endpoint

| Método | Ruta | Roles | Caso de uso |
| --- | --- | --- | --- |
| POST | `/geocodificacion` | administrador, despachador | `GeocodificarDireccion` (`{ direccion, ciudad? }`). Límite: 30 por minuto |
| POST | `/geocodificacion/inversa` | administrador, despachador, **ciudadano** (desde 2026-11-02) | `GeocodificarCoordenadas` (`{ latitud, longitud }`). Límite: 60 por minuto |

Respuestas:
- `200`: dirección encontrada y verificada. Trae `origen`: `almacenada` (no consumió la API) o `proveedor`.
- `422`: no se encontró una ubicación confiable, o falta la ciudad.
- `503`: proveedor sin configurar, sin respuesta, con la clave inválida o con la cuota agotada.

Los dos casos de uso **se exportan** (`GeocodingModule.exports`) para que emergencias o instituciones lo usen más adelante sin pasar por HTTP.

## Flujo (`GeocodificarDireccion`)

1. **Ciudad**: la de la solicitud o `GEOCODIFICACION_CIUDAD_PREDETERMINADA`; sin ninguna → `422`. Sin ciudad la búsqueda es ambigua: en la prueba real, "Calle 10 # 5-20" sin ciudad devolvió un pueblo de Sucre con confianza 1.
2. **Clave normalizada** (`normalizador_direcciones.ts`): `pais|ciudad|direccion`, en minúsculas, sin tildes ni signos y con las abreviaturas unificadas (`Cl`/`Cll` → `calle`, `Kra`/`Cra`/`Kr` → `carrera`, `Av` → `avenida`, `AK` → `avenida carrera`, `AC` → `avenida calle`, `Dg` → `diagonal`, `Tv` → `transversal`; se eliminan `#`, `No.`, `Nro.` y `N°`). Ejemplo: "CL 72 No. 15-20" en "bogota" → `co|bogota|calle 72 15 20`.
3. **Deduplicación en memoria**: dos solicitudes simultáneas con la misma clave comparten una sola consulta.
4. **Caché en BD**: si existe la clave y `esReutilizable()`, se responde sin consultar al proveedor. Las `encontrada` siempre son reutilizables; las `no_encontrada`, durante **7 días** (`DIAS_PARA_REINTENTAR_NO_ENCONTRADA`). Después se reintenta y se actualiza la misma fila.
5. **Proveedores en orden** (`GEOCODIFICACION_PROVEEDORES`): se omiten los que no están configurados (si no queda ninguno → `503`). Una falla técnica (`FallaProveedorGeocodificacion`) pasa al siguiente proveedor; si fallan todos → `503`, **sin guardar nada**.
6. **Elección del candidato**: cada proveedor devuelve hasta 5 candidatos, ya filtrados por su propia confiabilidad. Se toma el primero que:
   - tenga coordenadas válidas (en rango y distintas de `0,0`), y
   - **coincida con la nomenclatura pedida** (`coincideNomenclatura`): misma vía, número, cruce y placa, con letras y puntos cardinales.
7. **Persistencia** con `upsert` sobre la clave única: `encontrada` (con coordenadas, proveedor, id del resultado y confianza) o `no_encontrada` (sin coordenadas, **nunca inventadas**).

## Geocodificación inversa (`GeocodificarCoordenadas`), agregada el 2026-10-24

1. Valida las coordenadas (en rango y distintas de `0,0`) → si no, `422`.
2. **Clave**: el punto redondeado a **5 decimales (~1 m)**, por ejemplo `4.68552|-74.05285`. Dos clics casi en el mismo sitio comparten el resultado sin mezclar casas vecinas.
3. Deduplicación en memoria + caché en BD (`geocodificaciones_inversas`), con la misma regla de reutilización que la directa (`no_encontrada` se reintenta a los 7 días).
4. Recorre los proveedores con `ConsultorProveedores`. `geocodificarInverso` devuelve el **lugar más cercano** (`LugarEncontrado`) o `null` si no hay nada o el punto está fuera del país.
5. **Precisión** (`domain/services/precision_ubicacion.ts`, `clasificarPrecision`):
   - `exacta`: hay calle y placa a ≤ 25 m;
   - `aproximada`: hay calle a ≤ `GEOCODIFICACION_INVERSA_DISTANCIA_MAXIMA_M` (100 m por defecto);
   - `zona`: solo hay barrio, municipio o departamento;
   - `null`: no hay nada útil → `no_encontrada`.
6. **En `zona` no se atribuye al punto lo que está lejos.** En la prueba real, un punto rural en Sibaté tenía como lugar más cercano una escuela a 957 m. La entidad descarta el nombre, la calle, la placa, las coordenadas del lugar y su `place_id`, y guarda solo "Pie de Alto, Sibaté, Cundinamarca".
7. La distancia la **calcula el backend** (haversine, `common/utils/geografia.ts`) entre el punto y el lugar; no depende del campo `distance` de Geoapify.
8. El controlador responde `422` si el resultado es `no_encontrada`.

**Tabla `geocodificaciones_inversas`** (migración `20261024174516_geocodificaciones_inversas`):

| Columna | Detalle |
| --- | --- |
| `clave_punto` | Única |
| `latitud_solicitada`, `longitud_solicitada` | El punto tocado |
| `direccion` | Dirección completa |
| `linea_direccion` | "Cl 100 19 61" |
| `calle`, `numero`, `barrio`, `ciudad`, `departamento`, `codigo_postal`, `pais` | Componentes de la dirección |
| `latitud_direccion`, `longitud_direccion` | Dónde está el lugar encontrado |
| `distancia_metros` | Distancia entre el punto y el lugar |
| `precision` | `exacta`, `aproximada` o `zona` |
| `proveedor`, `proveedor_resultado_id` | Quién respondió y su id del resultado |
| `estado` | `encontrada` \| `no_encontrada` |
| `creada_en`, `actualizada_en` | Fechas |

Índice por (`estado`, `actualizada_en`). La misma migración **amplió `direcciones_geocodificadas.proveedor_resultado_id` a VARCHAR(512)**: el `place_id` de Geoapify codifica el nombre del lugar, ya llegó a 212 caracteres y podía pasar de 255.

**Prueba real por HTTP** (2026-10-24):

| Punto | Resultado |
| --- | --- |
| Calle 100 # 19-61, Bogotá | `exacta`, 0 m, "Cl 100 19 61" |
| Repetir con un clic casi igual | `almacenada` |
| Chapinero | `exacta`, 3.1 m, "Kr 12 71 40" |
| Cerca de un parque | `aproximada`, 45.3 m, "Ak 68 53 36" |
| Zona rural de Sibaté | `zona`, "Pie de Alto, Sibaté, Cundinamarca" |
| Medellín | `exacta`, "Cr 43a 1-50" |
| Caracas | `422` (fuera del país, guardado como `no_encontrada`) |
| `0,0` | `422` |
| Latitud 95 | `400` |
| Conductor | `403` |

**Refactor**: el recorrido de proveedores con respaldo pasó a `application/services/consultor_proveedores.service.ts` y la deduplicación a `application/services/consultas_en_curso.ts`; los usan las dos operaciones. El proveedor Geoapify comparte un único método `solicitar()` (HTTP + traducción de errores) para `search` y `reverse`.

## Por qué la verificación de nomenclatura (hallazgo en la prueba real)

Geoapify, que usa datos de OpenStreetMap, tiene poca cobertura de placas en Colombia y devuelve direcciones **parecidas** con mucha confianza. Para "Calle 72 # 15-20, Bogotá", el primer resultado fue **"Cl 72 S 15A 20 E"** (Calle 72 **Sur**, al otro extremo de la ciudad) con confianza 0.9. Por eso no basta con el puntaje del proveedor. `nucleoNomenclatura` extrae vía + número + cruce + placa ("Calle 72 Sur # 15A-20 apto 301" → `calle 72 sur 15a 20`) y exige que sea igual en lo pedido y en lo encontrado. Si lo pedido no sigue la nomenclatura (por ejemplo, el nombre de un lugar), no se compara y se confía en los filtros del proveedor.

## Proveedor Geoapify (`infrastructure/services/geoapify_proveedor.service.ts`)

- `GET https://api.geoapify.com/v1/geocode/search` con `fetch` nativo (sin dependencias nuevas), `format=json`, `lang=es`, `limit=5`, `filter=countrycode:<país>` y `AbortSignal.timeout`.
- **Envía la dirección sin `#` ni `No.`**: con el símbolo, Geoapify interpreta mal la placa y solo devuelve la calle.
- **Filtros propios**: `result_type` debe ser `building`, `amenity` o `street`; `rank.confidence` ≥ `GEOCODIFICACION_CONFIANZA_MINIMA`; y `country_code` debe ser el país configurado.
- **Errores**:

  | Respuesta | Motivo |
  | --- | --- |
  | 401 / 403 | `credenciales_invalidas` |
  | 429 | `limite_excedido` |
  | 5xx o error de red | `no_disponible` |
  | Timeout | `tiempo_agotado` |
  | Otro 4xx, JSON inválido o sin `results` | `respuesta_invalida` |

- La respuesta se valida desde `unknown`, sin `any`.
- **La API key va en la URL: nunca se escribe en el log.** El log solo registra el proveedor y el motivo, no la dirección.
- Una clave enmascarada (con `*`), incompleta o con caracteres que no sean alfanuméricos (`/^[A-Za-z0-9]{20,}$/`) deja el proveedor **sin configurar**, con un aviso en el log.

## Cómo agregar otro proveedor (Google, Nominatim…)

1. Crear una clase en `infrastructure/services/` que extienda `ProveedorGeocodificacion`, con `nombre`, `estaConfigurado()`, `geocodificar()` (devuelve `{ candidatos }`) y `geocodificarInverso()` (devuelve `{ lugar }`). Ante errores técnicos, lanza `FallaProveedorGeocodificacion`.
2. En `geocoding.module.ts`: crear su provider con una factory que lea sus variables, agregarlo a `inject` y a la lista `disponibles` de `RegistroProveedoresGeocodificacion`.
3. Validar sus variables en `src/config/variables_entorno.ts` y documentarlas en `.env.example` y el README.
4. Nombrarlo en `GEOCODIFICACION_PROVEEDORES` (por ejemplo, `geoapify,google`). El respaldo ya funciona: no hay que tocar el caso de uso.

## Tabla `direcciones_geocodificadas`

Migración `20261024152813_direcciones_geocodificadas`.

| Columna | Detalle |
| --- | --- |
| `id` | CHAR(36) |
| `direccion_original` | Lo que se envió |
| `direccion_normalizada` | Clave **única** |
| `ciudad` | Ciudad usada en la búsqueda |
| `direccion_formateada` | La dirección según el proveedor |
| `latitud`, `longitud` | DECIMAL(10,7), null si no se encontró |
| `proveedor` | Quién respondió |
| `proveedor_resultado_id` | `place_id` en Geoapify |
| `confianza` | DECIMAL(4,3) |
| `estado` | `encontrada` \| `no_encontrada` |
| `creada_en`, `actualizada_en` | Fechas |

Índices: único por `direccion_normalizada` e índice por (`estado`, `actualizada_en`).

## Archivos

```text
src/modules/geocoding/
├── domain/entities/direccion_geocodificada.entity.ts
├── domain/repositories/direcciones_geocodificadas.repository.ts
├── domain/services/normalizador_direcciones.ts           (normalizar, clave, núcleo y coincidencia)
├── domain/services/proveedor_geocodificacion.ts          (contratos ProveedorGeocodificacion y ProveedoresGeocodificacion, FallaProveedorGeocodificacion)
├── application/configuracion_geocodificacion.ts          (país y ciudad predeterminada)
├── application/use-cases/geocodificar_direccion.use-case.ts
├── infrastructure/repositories/prisma_direcciones_geocodificadas.repository.ts
├── infrastructure/services/geoapify_proveedor.service.ts
├── infrastructure/services/registro_proveedores_geocodificacion.service.ts
├── presentation/controllers/geocodificacion.controller.ts
├── presentation/dto/{geocodificar_direccion,direccion_geocodificada_respuesta}.dto.ts
├── test/  (normalizador, caso de uso, proveedor Geoapify con fetch simulado; dobles en test/dobles/)
└── geocoding.module.ts
```

Cambios en archivos compartidos:
- `src/config/variables_entorno.ts`: las 6 variables nuevas, todas opcionales.
- `src/common/exceptions/errores_dominio.ts`: `ServicioNoDisponibleError`.
- `src/common/filters/filtro_excepciones.filter.ts`: lo traduce a `503`.
- `prisma/schema.prisma`: modelo `DireccionGeocodificada`.
- `app.module.ts`, `.env`, `.env.example` y README.

## Pruebas (48, contando la inversa)

- Normalizador (10): formas de escribir, abreviaturas, clave con ciudad, núcleo y coincidencia, incluido el caso real "Calle 72 Sur".
- Caso de uso (13): proveedor y guardado, reutilización con otra escritura, no encontrada guardada y no repetida, reintento a los 7 días, falla → `503` sin guardar, respaldo al siguiente proveedor, proveedor sin configurar, coordenadas `0,0`, candidato parecido descartado, ciudad predeterminada u obligatoria, deduplicación simultánea.
- Geoapify (9): éxito y parámetros de la URL (sin `#`), baja confianza, solo ciudad, otro país, sin resultados, 401/429/503, respuesta con forma inesperada, timeout, clave enmascarada.

## Prueba real (2026-10-24, con la clave real y el MySQL local)

| Dirección | Resultado |
| --- | --- |
| Calle 100 # 19-61, Bogotá | ✅ 4.685519, -74.052851 ("Cl 100 19 61"), confianza 1 |
| Carrera 43A # 1-50, Medellín | ✅ 6.204423, -75.571304 ("Cr 43a 1-50"), confianza 0.7 |
| Calle 72 # 15-20 y Carrera 7 # 40-62, Bogotá | `no_encontrada`: Geoapify no tiene esa placa; se descartó el falso positivo "Calle 72 Sur" |
| La misma dirección escrita distinto ("CL 72 No. 15-20", "bogota") | Reutilizada de la BD en 3 ms |
| Sin ciudad | `422` "Indique la ciudad" |
| Timeout de Geoapify (más de 5 s) | `503`, sin guardar; por eso el tiempo por defecto quedó en 8 s |

## Limitaciones y pendientes

- **Cobertura**: Geoapify (OpenStreetMap) no tiene muchas placas de Colombia, sobre todo en Bogotá. Para esos casos, el frontend debe permitir **marcar el punto en el mapa**. Si se necesita más cobertura, el siguiente paso natural es agregar Google Geocoding como segundo proveedor (la arquitectura ya lo soporta).
- Aún no se geocodifica automáticamente al registrar una emergencia o una institución. El caso de uso está exportado para hacerlo.
- La deduplicación en memoria vale para una instancia; con varias instancias, el `upsert` evita duplicados en la BD, pero podría haber dos consultas al proveedor.
