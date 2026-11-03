# Destino del traslado y ruta al hospital

> Contexto general en [00-general.md](00-general.md). Módulo de rutas en [rutas.md](rutas.md). Guía para Flutter: `docs/RUTA_INSTITUCION_FLUTTER.md`.
> Implementado y verificado el 2026-11-02.

## Reglas de negocio (confirmadas por el usuario)

1. **Solo el conductor del servicio** elige o cambia la institución. El paramédico o médico y la central solo la consultan (`403` si lo intentan).
2. **`trasladando` no exige institución.** La ruta se genera cuando haya destino.
3. **El destino del servicio y el de la HC son independientes:** la HC refleja dónde se entregó finalmente al paciente.
4. **Cambiar el destino invalida la ruta y la recalcula**, registra quién lo cambió y usa una posición reciente de la ambulancia.

## Base de datos

Migración `20261102231818_destino_asignacion`, solo agrega columnas opcionales en `asignaciones_servicio`, con clave foránea: `institucion_destino_id`, `destino_actualizado_por_id` y `destino_actualizado_en`. Los servicios existentes quedan en `null`.

La columna `rutas_asignacion.tramo` ya existía.

## Endpoint

`PUT /asignaciones/{id}/destino` con `{ "institucionId": "uuid" }`. Rol `conductor` y `PermisoServicio.exigirConductor`, que comprueba que sea el conductor del turno de ese servicio.

| Respuesta | Cuándo |
| --- | --- |
| `200` | Definido o cambiado; también si se repite el mismo (sin registrar nada) |
| `400` | Id inválido o campos de más |
| `403` | Otro rol u otro conductor |
| `404` | Asignación o institución inexistente |
| `409` | El servicio salió de los estados permitidos durante la escritura |
| `422` | Institución inactiva o sin coordenadas; servicio fuera de `en_escena`, `atendiendo` y `trasladando` |

Toda respuesta de asignación suma `institucionDestino`, `destinoActualizadoPor` y `destinoActualizadoEn`. Así consultan el paramédico (`/mi-servicio`) y la central (`/asignaciones`).

El caso de uso `DefinirDestinoAsignacion` vive en `prehospital_care` porque necesita `InstitucionesSaludRepositorio`, y ese módulo ya depende de asignaciones; al revés habría una dependencia circular. `asignaciones` lee el destino con un `select` propio.

## Quién cambió el destino

- Último cambio: columnas `destino_actualizado_por_id` y `destino_actualizado_en`.
- Historial completo: `auditoria_eventos`, acción `definir_destino`, con usuario, institución anterior y nueva, estado del servicio e IP.

## Invalidación de la ruta

`RutaAsignacion.esVigentePara(asignacion)` exige:

- que el tramo corresponda al estado;
- en `hacia_destino`, que `destino` coincida con las coordenadas del hospital actual y que `calculadaEn >= destinoActualizadoEn`.

No hay columna de "invalidada": las rutas viejas se conservan como historial y dejan de ser vigentes solas. También cubre volver a un hospital anterior y que el administrador edite las coordenadas de la institución.

Lo usan `ObtenerRutaAsignacion`, `ConsultarRutasActivas` y `RecalculadorRutas`.

**Carreras cubiertas:**

- `calculadaEn` se toma **antes** de leer la asignación: un cálculo que empezó con el hospital anterior queda inválido.
- Tras responder el proveedor, se relee la asignación y se descarta si ya no sirve.
- La deduplicación incluye el destino: un cálculo en curso hacia el hospital A no absorbe el del B.

## Cuándo se calcula

| Disparo | Motivo | Origen |
| --- | --- | --- |
| Pasar a `trasladando` con hospital | `inicio_traslado` | Última posición de ≤ 10 min |
| Elegir o cambiar hospital en `trasladando` | `cambio_destino` | Igual |
| GPS sin ruta vigente | `sin_ruta` | Esa posición |
| GPS fuera de la ruta (> 150 m y ≥ 60 s) | `desvio` | Esa posición |

Elegir antes de `trasladando` no calcula nada. Sin hospital, el GPS no intenta calcular **ni consume el límite de reintentos**; al elegir uno, ese límite se libera.

## Cambios que afectan a otros clientes

- `GET /asignaciones/{id}/ruta` responde `404` en `en_escena`, `atendiendo`, `finalizada` y `cancelada`; antes devolvía la última ruta. El frontend ya trata ese `404` como "sin ruta" (el mensaje sigue conteniendo "Ruta").
- `GET /rutas/activas` incluye `trasladando`. El esquema del frontend acepta cualquier `tramo` y `motivo`, así que no se rompe, pero **dibujará esas rutas con textos pensados para la emergencia** hasta que se ajuste.

## Verificación

- `tsc`, `oxlint --type-aware` y Vitest en verde: 234 pruebas, 23 nuevas sobre las 211 anteriores.
- Prueba real contra una copia temporal de la BD (ya eliminada), con Geoapify: 43 comprobaciones de permisos, errores, flujo, cambio de destino, reintento, desvío, GPS viejo, traslado sin hospital, independencia de la HC, auditoría y Swagger.
- Esa prueba destapó y corrigió un bug: los GPS sin hospital consumían el límite de reintentos y retrasaban hasta 60 s la ruta.
- Eventos comprobados con un receptor HTTP. **No se probó** la entrega por socket ni la app.

## Pendiente

- La web no tiene aviso ni textos propios para el tramo al hospital.
- La llegada al hospital no se valida por distancia.
- `listarVigentes` y `buscarVigente` miran solo la ruta más reciente. Si un cálculo tardío inválido fuera la última fila, habría `404` hasta el siguiente GPS. Es muy improbable porque se relee antes de guardar.
