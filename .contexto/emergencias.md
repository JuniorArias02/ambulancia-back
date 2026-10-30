# Módulo de emergencias (`src/modules/emergencies`)

> Contexto general en [00-general.md](00-general.md). Guía para frontend: `docs/api-emergencias-frontend.md`.

## Qué hace

Registro de las llamadas o reportes de emergencia (accidentes de tránsito, caídas, heridas por arma, quemaduras, casos clínicos…), su corrección, cancelación y el manejo de **llamadas duplicadas** (varias personas reportan el mismo incidente). Usa la tabla `emergencias`, que ya existía en la migración `inicial`: **no se creó migración**.

Todos los endpoints son para **administrador y despachador** (`@RequiereRoles` a nivel de controlador).

## Endpoints

| Método | Ruta | Caso de uso | Para qué |
| --- | --- | --- | --- |
| POST | `/emergencias` | `RegistrarEmergencia` | Registrar (nace `recibida`, número automático) |
| GET | `/emergencias` | `ConsultarEmergencias` | Listar con filtros, de la más reciente a la más antigua |
| GET | `/emergencias/{id}` | `ObtenerEmergencia` | Detalle |
| PATCH | `/emergencias/{id}` | `ActualizarEmergencia` | Corregir datos mientras esté activa (por ejemplo, re-clasificar la prioridad) |
| PATCH | `/emergencias/{id}/cancelar` | `CancelarEmergencia` | Cancelar con `motivo` (solo si está `recibida`) |
| PATCH | `/emergencias/{id}/duplicada` | `MarcarEmergenciaDuplicada` | Marcar como duplicada de otra (`emergenciaPrincipalId`) |
| GET | `/emergencias/{id}/posibles-duplicadas` | `BuscarPosiblesDuplicadas` | Sugerir emergencias activas cercanas o con la misma dirección |

Filtros de `GET /emergencias`: `busqueda` (número, descripción, dirección, nombre o teléfono del informante), `estado`, `soloActivas`, `prioridad`, `tipoIncidente`, `desde`, `hasta` (sobre `recibidaEn`), `pagina`, `limite`.

## Catálogos (constantes en `emergencia.entity.ts`)

| Constante | Valores |
| --- | --- |
| `FUENTES_EMERGENCIA` | `linea_123`, `telefono`, `radio`, `app` |
| `TIPOS_INCIDENTE` | `accidente_transito`, `caida`, `arma`, `quemadura`, `clinico`, `otro` |
| `PRIORIDADES_EMERGENCIA` | `roja`, `amarilla`, `verde` |
| `ESTADOS_EMERGENCIA` | `recibida`, `despachada`, `en_atencion`, `cerrada`, `cancelada` |
| `ESTADOS_ACTIVOS` | `recibida`, `despachada`, `en_atencion` |

Son los mismos valores que documentan los comentarios del modelo `Emergencia` en `schema.prisma`.

## Entidad `Emergencia`

Campos: `id`, `numeroEmergencia`, `fuente`, `informanteNombre`, `informanteTelefono`, `descripcion`, `tipoIncidente`, `prioridad`, `direccion`, `referenciaLugar`, `coordenadas` (`{ latitud, longitud } | null`), `numeroVictimas`, `estado`, `emergenciaPrincipalId`, `recibidaPorId`, `recibidaPorNombre` (solo lectura, viene del join con `usuarios`), `recibidaEn`, `cerradaEn`.

Métodos: `crear()`, `reconstruir()`, `prefijoNumero()`, `formatearNumero()`, `estaActiva()`, `esDuplicada()`, `actualizarDatos()`, `cancelar()`, `marcarDuplicadaDe()`.

## Reglas de negocio

1. **Número automático** `EMG-AAAAMMDD-NNNN`, consecutivo por día según la **fecha de Colombia** (`America/Bogota`), no la del servidor. El repositorio da el último consecutivo del prefijo y el caso de uso suma 1.
2. **Colisión de número**: si dos despachadores registran al mismo tiempo, el `P2002` se traduce a `NumeroEmergenciaEnUsoError` y `RegistrarEmergencia` **reintenta hasta 3 veces**.
3. **Nace `recibida`** y guarda en `recibidaPorId` quién la registró (sale del token).
4. **Ubicación obligatoria**: dirección o coordenadas (al menos una) → si no, `422`. Latitud y longitud van **juntas** → si llega una sola, `422`.
5. Los textos se recortan y un texto vacío queda en `null`.
6. **Editar** solo mientras esté activa (`recibida`, `despachada`, `en_atencion`). Cerrada o cancelada → `422`. En el `PATCH`, `undefined` deja el valor igual y `null` lo borra.
7. **Cancelar** solo si está `recibida` (una vez despachada, se cancelará desde la asignación). Pone `cerradaEn`.
8. **Marcar duplicada** solo si está `recibida`. La principal debe existir (si no, `422`), no puede ser ella misma, no puede ser a su vez duplicada (se apunta siempre a la original) y no puede estar cancelada. La duplicada queda `cancelada`, con `emergenciaPrincipalId` y `cerradaEn`.
9. **Control de concurrencia**: `actualizar(emergencia, estadoEsperado)` usa `updateMany` con `where: { id, estado: estadoEsperado }`. Si otro usuario cambió el estado, responde `409` "La emergencia cambió mientras tanto; vuelva a consultarla".
10. **Estados `despachada`, `en_atencion` y `cerrada` no se ponen a mano**: los pondrá el futuro módulo de asignaciones (por eso el módulo exporta `EmergenciasRepositorio`).
11. **Auditoría** (`entidad: 'emergencias'`):
    - `crear`: guarda número, tipo y prioridad;
    - `actualizar`: guarda los campos enviados y, si cambió la prioridad, `prioridadAnterior` y `prioridadNueva`;
    - `cancelar`: guarda `estadoAnterior` y `motivo`;
    - `marcar_duplicada`: guarda el id y el número de la principal.

    Los datos del informante **no** van a la auditoría.

## Posibles duplicados (`domain/services/criterios_duplicados.ts`)

Sigue `arquitectura.md`: se sugieren con criterios explícitos y **nunca se fusionan solos**; el despachador decide.

- **Ventana**: emergencias activas, no duplicadas, recibidas hasta **120 minutos** antes de la emergencia consultada (y después).
- **Criterios** (`CRITERIOS_DUPLICADOS`):
  - `cercania`: a ≤ **500 m** (fórmula de haversine; requiere coordenadas en ambas);
  - `misma_direccion`: la dirección es igual sin tildes, mayúsculas, espacios ni signos (`Calle 72 # 15-20` = `calle 72 #15 20`);
  - `mismo_tipo`: dato informativo; solo se agrega si ya cumplió uno de los dos anteriores.
- Una candidata se sugiere si cumple `cercania` o `misma_direccion`. Se ordenan de la más cercana a la más lejana (las que no tienen distancia van al final).
- La ventana y el radio son constantes del dominio. Si el negocio necesita cambiarlos sin desplegar, se pueden pasar a variables de entorno.

## Decisiones tomadas

- **El motivo de cancelación queda solo en la auditoría**, porque la tabla `emergencias` no tiene columna para eso (`asignaciones_servicio` sí tiene `motivo_cancelacion`). Si el frontend necesita mostrarlo en el detalle, habría que agregar la columna `motivo_cancelacion` con una migración.
- La prioridad la puede poner y cambiar el despachador; cada cambio queda auditado con el antes y el después.
- La respuesta incluye `recibidaPor: { id, nombreCompleto }` porque el despachador no tiene acceso a `GET /usuarios/{id}`.

## Archivos

```text
src/modules/emergencies/
├── domain/entities/emergencia.entity.ts (+ spec)
├── domain/repositories/emergencias.repository.ts   (contrato + NumeroEmergenciaEnUsoError)
├── domain/services/criterios_duplicados.ts
├── application/use-cases/  registrar_emergencia (+ spec), consultar_emergencias, obtener_emergencia,
│                           actualizar_emergencia, cancelar_emergencia, marcar_emergencia_duplicada,
│                           buscar_posibles_duplicadas (+ spec)
├── infrastructure/repositories/prisma_emergencias.repository.ts
├── presentation/controllers/emergencias.controller.ts
├── presentation/dto/  validaciones_emergencia, registrar, actualizar, cancelar, marcar_duplicada,
│                      consultar, emergencia_respuesta (incluye paginado y posible duplicada)
└── emergencies.module.ts
test/dobles/emergencias_memoria.ts   (EmergenciasMemoria con colisionesPendientes, crearEmergenciaPrueba)
```

## Historia (2026-10-24)

1. Se cambió la conexión al MySQL local (`ambulancia`, puerto 3306) y se aplicaron migraciones y seed.
2. Se construyó el módulo completo. Pruebas: **12 nuevas** (7 de la entidad, 3 de registro con reintentos, 2 de duplicados). Total del proyecto: **44/44**.
3. Se probó el flujo real con curl contra el `start:dev` y el MySQL local:
   - registrar y generar el consecutivo;
   - `422` sin ubicación y `400` por enum inválido o campo extra;
   - sugerir duplicados (99 m, misma dirección, mismo tipo) y marcar la duplicada;
   - `422` al cancelar una duplicada;
   - re-clasificar la prioridad y borrar un campo con `null`;
   - `422` con solo la latitud;
   - listar las activas, cancelar y `422` al editar una cancelada.
4. **Bug encontrado y corregido en los tres módulos** (usuarios, ambulancias y emergencias): el detalle de auditoría `campos` usaba `Object.keys(datos)`, que incluía todas las propiedades del DTO aunque llegaran como `undefined`. Ahora se filtran con `Object.entries(...).filter(valor !== undefined)`.
5. En la BD local quedaron 3 emergencias de prueba (`EMG-20261024-0001` a `0003`).

## Cambios posteriores (2026-10-24, con asignaciones)

- La entidad tiene `despachar()`, `iniciarAtencion()`, `cerrar()` y `volverARecibida()`. Los usan las asignaciones; ningún endpoint de emergencias los expone. Ver [asignaciones.md](asignaciones.md).
- `distanciaMetros` se movió a `src/common/utils/geografia.ts`.

## Pendiente / siguiente (original)

- **Turnos** (`turnos`, `turnos_integrantes`): tripulación por ambulancia.
- **Asignaciones** (`asignaciones_servicio`): despachar una ambulancia `disponible` a una emergencia `recibida`. La emergencia pasa a `despachada` → `en_atencion` → `cerrada` y la ambulancia a `en_servicio`. Para eso hay que agregar en la entidad los métodos `despachar()`, `iniciarAtencion()` y `cerrar()`.
- Notificar en tiempo real (WebSocket) cuando entra una emergencia nueva.
- Decidir si se agrega la columna `motivo_cancelacion` a `emergencias`.
