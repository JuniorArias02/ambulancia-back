# Módulo de ambulancias (`src/modules/ambulances`)

> Contexto general en [00-general.md](00-general.md). Guía de construcción: `docs/guia-modulo-ambulancias.md`. Guía para frontend: `docs/api-ambulancias-frontend.md`.

## Qué hace

Registro de la flota, tipos de ambulancia (TAB/TAM) y estado operativo de cada ambulancia, con historial de quién cambió el estado, cuándo y por qué.

## Endpoints

| Método | Ruta | Roles | Caso de uso |
| --- | --- | --- | --- |
| GET | `/tipos-ambulancia` | administrador, despachador | `ConsultarTiposAmbulancia` |
| POST | `/ambulancias` | administrador, despachador | `CrearAmbulancia` |
| GET | `/ambulancias` | administrador, despachador | `ConsultarAmbulancias` (filtros `busqueda`, `estadoOperativo`, `tipoAmbulanciaId` + paginación; orden por código) |
| GET | `/ambulancias/{id}` | administrador, despachador | `ObtenerAmbulancia` |
| PATCH | `/ambulancias/{id}` | administrador, despachador | `ActualizarAmbulancia` (código, placa o tipo) |
| PATCH | `/ambulancias/{id}/estado` | administrador, despachador | `CambiarEstadoAmbulancia` (`estado` + `motivo` 5–255) |
| GET | `/ambulancias/{id}/historial-estados` | administrador, despachador | `ConsultarHistorialEstadosAmbulancia` (del más reciente al más antiguo) |

## Tipos de ambulancia

Catálogo en la tabla `tipos_ambulancia`, sembrado por `sembrarTiposAmbulancia()` en `prisma/seed.ts`:
- `TAB`: Transporte Asistencial Básico
- `TAM`: Transporte Asistencial Medicalizado

A diferencia de los roles, el frontend envía el **`id`** del tipo (`tipoAmbulanciaId`).

## Entidad `Ambulancia`

Campos: `id`, `codigo`, `placa`, `tipo` (`TipoAmbulancia`), `estadoOperativo`, `ultimaUbicacion | null` (`{ latitud, longitud, registradaEn }`), `creadaEn`.

- Estados (`ESTADOS_OPERATIVOS`): `disponible`, `en_servicio`, `fuera_servicio`, `mantenimiento`.
- Estados que se pueden poner a mano (`ESTADOS_MANUALES`): todos menos `en_servicio`.
- Métodos: `crear()`, `reconstruir()`, `normalizarCodigo()`, `normalizarPlaca()`, `esEstadoValido()`, `estaDisponible()`, `actualizarDatos()`, `cambiarEstadoManual()`.

## Reglas de negocio

1. **Código y placa únicos y normalizados** antes de validar y guardar: código → trim + mayúsculas (`amb-01` → `AMB-01`); placa → sin espacios ni guiones + mayúsculas (`abc 123` / `abc-123` → `ABC123`). Repetido → `409`.
2. **Una ambulancia nueva nace `fuera_servicio`.**
3. **Transiciones manuales** (`TRANSICIONES_MANUALES`):

   | Desde | Puede pasar a |
   | --- | --- |
   | `disponible` | `fuera_servicio`, `mantenimiento` |
   | `fuera_servicio` | `disponible`, `mantenimiento` |
   | `mantenimiento` | `disponible`, `fuera_servicio` |
   | `en_servicio` | ninguno |

   Mismo estado o transición no permitida → `422`. Enviar `en_servicio` → `400` (lo rechaza el DTO).
4. **`en_servicio` nunca se pone a mano**: lo pondrá y lo quitará el futuro módulo de asignaciones.
5. **Cada cambio de estado se guarda junto con su fila en `estados_ambulancia_historial` en una sola transacción.**
6. **Control de concurrencia**: `cambiarEstado` en Prisma usa `updateMany` con `where: { id, estadoOperativo: estadoAnterior }`. Si otro usuario cambió el estado entre la lectura y la escritura, `count === 0` → `409` "El estado de la ambulancia cambió mientras tanto; vuelva a consultarla".
7. **No se edita una ambulancia `en_servicio`** → `422`.
8. Al editar, `existeCodigo` / `existePlaca` reciben `excluirId` para no chocar con la propia ambulancia.
9. Tipo inexistente → `422`.
10. Crear, actualizar y cambiar estado quedan en **auditoría** (`entidad: 'ambulancias'`, acciones `crear`, `actualizar`, `cambiar_estado`).

## Validaciones de entrada

| Campo | Regla |
| --- | --- |
| `codigo` | `/^[A-Za-z0-9-]{2,30}$/` |
| `placa` | `/^[A-Za-z]{3}[\s-]?\d{3}$/` (placa colombiana de vehículo) |
| `tipoAmbulanciaId` | UUID |
| `busqueda` | Texto, máx. 30 (busca con `contains` en código o placa; el frontend debe quitarle espacios y guiones al buscar placas) |

## Infraestructura

- `prisma_ambulancias.repository.ts`: `select` explícito, convierte `Decimal` → `number` en la ubicación, valida que el estado leído de la BD sea conocido, traduce `P2002` a `409`.
- `prisma_tipos_ambulancia.repository.ts`: `listar` (orden por nombre) y `buscarPorId`.
- El módulo **exporta** `AmbulanciasRepositorio` para el futuro módulo de asignaciones.

## Estructura de archivos

```text
src/modules/ambulances/
├── domain/entities/        tipo_ambulancia, ambulancia (+ spec), cambio_estado_ambulancia
├── domain/repositories/    tipos_ambulancia.repository.ts, ambulancias.repository.ts
├── application/use-cases/  consultar_tipos_ambulancia, crear_ambulancia (+ spec), consultar_ambulancias,
│                           obtener_ambulancia, actualizar_ambulancia, cambiar_estado_ambulancia (+ spec),
│                           consultar_historial_estados_ambulancia
├── infrastructure/repositories/  prisma_tipos_ambulancia, prisma_ambulancias
├── presentation/controllers/     tipos_ambulancia.controller.ts, ambulancias.controller.ts
├── presentation/dto/             validaciones, crear, actualizar, cambiar_estado, consultar, respuestas
└── ambulances.module.ts
test/dobles/ambulancias_memoria.ts   (TiposAmbulanciaMemoria, AmbulanciasMemoria, crearAmbulanciaPrueba)
```

## Historia de cómo se construyó (2026-10-24)

1. Se escribió `docs/guia-modulo-ambulancias.md` con el código completo, ya probado.
2. El desarrollador lo empezó a mano hasta los casos de uso. En la revisión aparecieron estos errores:
   - el contrato `cambiarEstado(ambulanciaId, nuevoEstado)` no coincidía con su uso ni permitía guardar el historial;
   - imports con `.ts` en lugar de `.js`; faltaba `estadoNuevo` en el historial; el spec estaba vacío;
   - `Ambulancia.crear()` no normalizaba, y `normalizarPlaca` no quitaba espacios ni guiones (la regla de unicidad no funcionaba);
   - se lanzaba `new Error(...)` en vez de errores de dominio (respondía 500 en vez de 404/409/422);
   - `CambiarEstadoAmbulancia` llamaba a `actualizar()` antes de `cambiarEstado()` y devolvía la entidad equivocada;
   - a `ConsultarAmbulancias` le faltaba `@Injectable()`; había nombres con errores (`ActualziarAmbulancia`, `tipos_ambulancia_entity.ts`, `tipoAmbulancia` en vez de `tipoAmbulanciaId`, `creadoEn`/`registrarEn`).
3. Se reemplazó todo por la versión de la guía y se completó el resto: infraestructura, DTOs, controladores, módulo, registro en `app.module.ts`, seed, README, dobles y pruebas.
4. Resultado: `typecheck` y `lint` limpios, **32/32 pruebas** y seed ejecutado (TAB y TAM en la BD).
5. Se creó `docs/api-ambulancias-frontend.md` para el equipo de frontend.

## Cambios posteriores (2026-10-24, con turnos y asignaciones)

- **Pasar a `disponible` exige tripulación completa** (`CambiarEstadoAmbulancia` depende de `TurnosRepositorio`). También pasa sola al completarse o quedar incompleta: ver [seleccion-ambulancia.md](seleccion-ambulancia.md).
- La entidad tiene `iniciarServicio()` y `finalizarServicio()`, que usan las asignaciones para manejar `en_servicio`. Ver [asignaciones.md](asignaciones.md).
- El módulo ahora también contiene **turnos** (desde el 2026-11-01 ya no importa `UsersModule`).
- `ultimaUbicacion` se actualiza con cada reporte GPS. Ver [ubicaciones.md](ubicaciones.md).

## Pendiente (original)

- Probar en Swagger el flujo del Paso 9 de la guía.
- ~~Turnos~~, ~~GPS~~ y ~~asignaciones~~: hechos (ver arriba).
