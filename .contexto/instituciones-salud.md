# Instituciones de salud (`src/modules/prehospital_care`)

> Contexto general en [00-general.md](00-general.md). Guía para frontend: `docs/api-despacho-frontend.md` (sección 6).

## Qué hace

Catálogo de hospitales y clínicas a donde se traslada al paciente (`instituciones_salud`). Está en el módulo `prehospital_care` porque ahí irá después la historia clínica, que referencia la institución de destino.

## Endpoints

| Método | Ruta | Roles | Caso de uso |
| --- | --- | --- | --- |
| POST | `/instituciones-salud` | admin | `CrearInstitucionSalud` |
| GET | `/instituciones-salud` | todos los roles | `ConsultarInstitucionesSalud` (filtros `busqueda`, `activa`, `nivelComplejidad`; opcional `latitud` y `longitud` para ordenar por cercanía) |
| GET | `/instituciones-salud/{id}` | todos los roles | `ObtenerInstitucionSalud` |
| PATCH | `/instituciones-salud/{id}` | admin | `ActualizarInstitucionSalud` |
| PATCH | `/instituciones-salud/{id}/estado` | admin | `CambiarEstadoInstitucionSalud` (`{ activa }`) |

## Reglas

1. `nombre` obligatorio. `codigoHabilitacion` (código REPS) es opcional pero **único** (se valida en el caso de uso → `409`; la BD no tiene índice único).
2. `nivelComplejidad`: `baja`, `mediana` o `alta`. Si en la BD hay otro valor cargado a mano, se devuelve `null` en vez de fallar.
3. Latitud y longitud van juntas (`422`).
4. **No se borran: se inactivan**, porque las historias clínicas las referencian. Cambiar al mismo estado → `422`.
5. **Por cercanía**: con `latitud` y `longitud` se traen todas las que cumplen los filtros, se calcula la distancia en línea recta (`src/common/utils/geografia.ts`, haversine) y se ordenan; las que no tienen coordenadas van al final. La paginación se hace en memoria (el catálogo es pequeño). Sin coordenadas, se ordena por nombre en la BD.
6. Auditoría en `entidad: 'instituciones_salud'`: `crear`, `actualizar`, `activar` e `inactivar`.

## Nota

`distanciaMetros` (haversine) se movió a `src/common/utils/geografia.ts`. Lo usan también los posibles duplicados de emergencias.
