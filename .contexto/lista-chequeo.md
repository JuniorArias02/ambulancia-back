# Lista de chequeo diaria (`src/modules/checklists`)

> Contexto general en [00-general.md](00-general.md). Implementado el 2026-11-10, fase 1 del módulo del conductor. Guía de transcripción paso a paso: `.CheckList/`. Diseño de BD: `prisma/lista_chequeo.bd`.

## Qué hace

- El **administrador** configura una lista de chequeo: preguntas y opciones de calificación (inicialmente Bien, Regular y Estable).
- El **conductor**, en la ambulancia que eligió en la app, la diligencia **una vez al día por ambulancia**: borrador → finalizado.
- La **central** (administrador y despachador) consulta el historial.

## Seed

`npm run db:semilla` crea la **"Lista de chequeo diaria de ambulancia"**: 15 preguntas obligatorias que admiten observación (vehículo primero, luego equipo médico) y las opciones Bien = 2, Regular = 1 y Estable = 0.

- **Idempotente:** si ya existe una lista con ese nombre, no la toca.
- **Solo la activa si no hay otra activa:** nunca reemplaza una lista que ya configuró el administrador.
- **Creador:** el administrador del seed (`SEMILLA_ADMIN_CORREO`).

## Base de datos

Migración `20261110014254_lista_chequeo` (5 tablas, solo aditiva):

| Tabla | Detalle |
| --- | --- |
| `listas_chequeo` | La lista |
| `estados_lista_chequeo` | Opciones de calificación |
| `items_lista_chequeo` | Preguntas |
| `chequeos_diarios` | Formulario del día. Índice único `uk_chequeo_diario` (lista, conductor, ambulancia, fecha) |
| `respuestas_chequeo` | Respuesta a una pregunta. Índice único `uk_respuesta_item` (chequeo, ítem) |

Todas las claves foráneas son `RESTRICT`: nada se borra, se desactiva.

## Decisiones (confirmadas por el usuario)

1. **Una sola lista activa.** `activarUnica` apaga las demás en la misma transacción. La lista **nace inactiva**, para que toda activación pase por ahí.
2. **Un chequeo por conductor, ambulancia y día.** Si el conductor cambia de ambulancia, diligencia otro.
3. **Opciones configurables;** Bien, Regular y Estable son las iniciales.
4. **Borrador → finalizado.** Finalizado no se edita.

Reglas agregadas:

- **El texto de una pregunta ya respondida no se cambia** (`409`): se desactiva y se crea otra.
- **Siempre queda al menos 1 pregunta y 2 opciones activas.**
- **La respuesta se valida contra la lista del chequeo,** no contra la activa. Si el administrador activa otra lista a mitad del día, el borrador conserva la suya.
- **`tieneObservacion: true`** exige texto y solo vale si la pregunta lo permite. Con `false`, el texto se descarta.
- **La fecha es el día de Colombia** (`ChequeoDiario.fechaDelDia` con `diaColombia`); el DATE se guarda como medianoche UTC.
- **Conductor y ambulancia salen del token y del turno** (`AmbulanciaDelConductor` con `TurnosRepositorio`), nunca del cuerpo. Sin turno → `422`; en el turno, pero no como conductor → `403`.

## Endpoints

| Grupo | Roles | Rutas |
| --- | --- | --- |
| Configuración | administrador | `POST/GET /listas-chequeo`, `GET/PATCH /listas-chequeo/{id}`, `PATCH /listas-chequeo/{id}/estado`, `POST /listas-chequeo/{id}/items`, `PATCH /listas-chequeo/{id}/items/{itemId}`, `POST /listas-chequeo/{id}/estados`, `PATCH /listas-chequeo/{id}/estados/{estadoId}` |
| Conductor | conductor | `GET/POST /mi-chequeo-diario`, `PUT /mi-chequeo-diario/respuestas`, `POST /mi-chequeo-diario/finalizar`, `GET /mi-chequeo-diario/historial`, `GET /mi-chequeo-diario/historial/{id}` |
| Historial | administrador, despachador | `GET /chequeos-diarios`, `GET /chequeos-diarios/{id}` |

Contratos completos: `docs/LISTA_CHEQUEO_FLUTTER.md` (conductor) y `docs/LISTA_CHEQUEO_FRONTEND.md` (web).

## Concurrencia

- **Iniciar es idempotente:** si choca con `uk_chequeo_diario` (`P2002`), devuelve el existente. Probado: 5 inicios simultáneos crean 1 chequeo.
- **Responder:** transacción con `SELECT … FOR UPDATE` sobre el chequeo y *upsert* por `(chequeoId, itemId)`. Si ya está finalizado, `409`.
- **Finalizar:** `updateMany … where estado = 'borrador'`; `count === 0` → `409`.

## Auditoría

| Entidad | Acciones |
| --- | --- |
| `listas_chequeo` | `crear` (`nombre`, `totalPreguntas`, `totalOpciones`), `actualizar` (`campos`), `activar`, `desactivar`, `agregar_pregunta`, `actualizar_pregunta`, `agregar_opcion`, `actualizar_opcion` |
| `chequeos_diarios` | `iniciar` (`ambulanciaId`, `fecha`), `finalizar` (`totalRespuestas`, `conObservacion`) |

## Pruebas

- 25 unitarias (330 en total). Dobles en `checklists/test/dobles/`.
- Prueba real por HTTP sobre una copia temporal de la BD (ya eliminada): 36 comprobaciones de permisos, validaciones, DTO anidados, concurrencia, día de Colombia, historial y auditoría.

## Historia

El usuario escribió los pasos 1 y 2 a partir de la guía. Al revisarlos se encontraron errores que se corrigieron con la versión de la guía:

- `slice(0.4)` en lugar de `slice(0, 4)`: la fecha salía mal;
- imports accidentales de otros módulos (`RecalculadorRutas`, el cliente de Geoapify) en el dominio;
- `RecursoNoEncontradoError` (404) donde correspondía `ReglaNegocioError` (422);
- falta de `observacion` en la respuesta (no compilaba);
- nombres distintos a los de la BD y a los pasos siguientes (`activo` / `creadoPorId`).

## Pendiente

- La web no tiene aún las pantallas de configuración ni de historial (`docs/LISTA_CHEQUEO_FRONTEND.md`).
- La app no tiene aún la pantalla del conductor (`docs/LISTA_CHEQUEO_FLUTTER.md`).
- ¿Exigir el chequeo finalizado antes de poder despachar la ambulancia? Hoy son independientes; es una decisión de negocio.
- Si se necesita, calcular puntajes con `valor` de las opciones (hoy solo se guarda).
