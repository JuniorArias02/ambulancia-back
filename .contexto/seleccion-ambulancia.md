# Selección de ambulancia por la tripulación

> Contexto general en [00-general.md](00-general.md). Modelo de turnos en [turnos.md](turnos.md). Guías para los clientes: `docs/instrucciones-agente-flutter.md` y `docs/instrucciones-agente-frontend.md`.
> Implementado y verificado el 2026-11-01.

## Lógica de negocio

| Quién | Qué hace |
| --- | --- |
| **Despachador** | Crea y administra ambulancias (registrar, editar, cambiar estado) y despacha emergencias. **Ya no asigna conductores ni paramédicos.** Puede cerrar un turno que quedó abierto |
| **Administrador** | Lo mismo que el despachador en este flujo |
| **Conductor y paramédico** | Seleccionan su ambulancia y salen de ella desde Flutter |
| **Backend** | Toma el usuario del token y la función de su rol; arma el turno y mantiene el estado de la ambulancia según su tripulación |

El cliente solo envía `ambulanciaId`. Enviar `funcion` o `usuarioId` responde `400`.

## Decisiones

1. **Se reutilizan `turnos` y `turnos_integrantes`.** Asignaciones, permisos, GPS, rutas, historia clínica y tiempo real ya dependen de "el turno activo de la ambulancia o del usuario": siguen funcionando sin cambios.
2. **Un turno con servicios no cambia de tripulación.** Si alguien entra a un turno que ya tuvo asignaciones, el turno se cierra y sigue uno nuevo con la tripulación ampliada. Si alguien sale, el turno siempre se cierra con su tripulación y los demás siguen en uno nuevo.
   - **Por qué:** `asignacion.turnoId` es lo que da acceso al servicio y a la historia clínica (también después de terminar). Editar la tripulación daría acceso a quien no atendió y se lo quitaría a quien sí.
   - **Consecuencia:** un turno ya no equivale a una jornada completa. Sin servicios, entrar sí agrega a la persona al mismo turno.
3. **La ambulancia cambia de estado sola.**
   - `fuera_servicio` → `disponible` cuando una selección completa la tripulación (conductor + paramédico o médico).
   - `disponible` → `fuera_servicio` cuando una salida deja la tripulación incompleta.
   - Ambos cambios quedan en `estados_ambulancia_historial` con el usuario y el motivo.
   - No se reactiva una ambulancia que la central sacó de servicio con la tripulación ya completa si llega un integrante adicional.
4. **Se eliminaron `POST /turnos` y `PUT /turnos/{id}/integrantes`**, con sus casos de uso, DTO y `ValidadorTripulacion`: contradicen la regla nueva. Las filas y la auditoría anteriores se conservan. **Efecto mientras el frontend se actualiza:** esas pantallas reciben `404`.
5. **`PATCH /turnos/{id}/finalizar` se conserva para la central.** Es la única salida cuando alguien olvida salir o pierde el celular; sin ella, el cupo quedaría ocupado para siempre. No agrega personas a una ambulancia.
6. **El despachador puede crear y editar ambulancias** (antes `POST` y `PATCH /ambulancias` eran solo del administrador).

## Base de datos y migraciones

**No hizo falta ninguna migración.** El esquema ya soporta el flujo y no se modificó ningún dato:

- los integrantes ya son filas por persona, y un turno puede tener una sola;
- `prisma migrate status`: 6 migraciones aplicadas, esquema al día;
- los dos turnos activos y los dos servicios en curso de la BD local siguen como estaban;
- antes de implementar se comprobó en esa BD que ningún usuario está en dos turnos activos y ninguna ambulancia tiene dos.

No hay restricción única en la BD para "un turno activo por usuario o por ambulancia": depende del estado, y MySQL necesitaría una columna generada que Prisma no representa. La garantía son los bloqueos de la sección Concurrencia. Todo lo que hoy modifica tripulaciones pasa por ellos.

## Endpoints

Prefijo `/api/v1`, con `Authorization: Bearer`.

### Nuevos (`conductor`, `paramedico`; los demás roles reciben `403`)

| Método | Ruta | Cuerpo | Éxito | Errores |
| --- | --- | --- | --- | --- |
| GET | `/mi-ambulancia/opciones` | — | `200` lista | — |
| POST | `/mi-ambulancia` | `{ "ambulanciaId": "uuid" }` | `200` `Turno` | `400`, `404`, `409`, `422` |
| DELETE | `/mi-ambulancia` | — | `204` | `422` |

Elemento de `opciones`:

```json
{
  "id": "uuid", "codigo": "SEL-01", "placa": "SEL001",
  "tipo": { "id": "uuid", "nombre": "TAB", "descripcion": "Transporte Asistencial Básico" },
  "estadoOperativo": "fuera_servicio",
  "tripulacion": [{ "nombreCompleto": "Pedro Díaz", "funcion": "conductor" }],
  "esMia": false,
  "seleccionable": true,
  "motivoNoSeleccionable": null
}
```

`motivoNoSeleccionable`: `ya_en_otra_ambulancia`, `en_servicio`, `mantenimiento`, `conductor_ocupado`, `tripulacion_llena` o `null`.

### Modificados

| Endpoint | Cambio |
| --- | --- |
| `POST /ambulancias`, `PATCH /ambulancias/{id}` | Ahora también el despachador |
| `PATCH /ambulancias/{id}/estado` | Pasar a `disponible` exige tripulación **completa**, no solo turno activo (`422`) |
| `POST /asignaciones` | Exige tripulación completa (`422`); si cambió mientras tanto, `409` |
| `Turno` en toda respuesta y evento | Nuevo campo `tripulacionCompleta: boolean` |
| `PATCH /turnos/{id}/finalizar` | Toma el bloqueo de la ambulancia |

### Eliminados

`POST /turnos` y `PUT /turnos/{id}/integrantes` → `404`.

### Sin cambios

`GET /turnos`, `GET /turnos/{id}`, `GET /mi-servicio` (con `tripulacionCompleta` dentro de `turno`) y `POST /ubicaciones` (sin turno, `422`).

## Reglas de asignación

**Seleccionar**, en este orden:

| Condición | Resultado |
| --- | --- |
| Rol sin función de tripulación | `403` |
| Ya está en esa ambulancia | `200` con el turno actual; no audita ni publica (idempotente) |
| Está en otra ambulancia | `409`: debe salir primero |
| Ambulancia inexistente | `404` |
| Ambulancia `en_servicio` | `409`: la tripulación que atiende queda fija |
| Ambulancia `mantenimiento` | `422` |
| Es conductor y ya hay conductor | `409` |
| Ya hay 4 integrantes | `409` |

Función por rol: `conductor` → `conductor`, `paramedico` → `paramedico`. La función `medico` sigue siendo válida para leer turnos y para la historia clínica, pero **hoy nadie puede tomarla**: no hay rol médico, y dejar que el cliente la declare iría contra `arquitectura.md` §8. La BD local no tiene filas con `medico`.

Cupos: 1 conductor y hasta 4 personas en total.

**Salir:** sin ambulancia → `204` sin efectos. Con la ambulancia `en_servicio` → `422`. Cerrar sesión **no** libera la ambulancia.

**Despachar:** ambulancia `disponible` + turno activo + tripulación completa.

## Concurrencia

- `TurnosRepositorio.enExclusiva()` abre una transacción y bloquea con `SELECT … FOR UPDATE` **primero la ambulancia y después el usuario**; las reglas se leen ya con el bloqueo tomado. La usan seleccionar, salir y finalizar.
- **El orden importa:** con usuario → ambulancia la prueba de carga dio `1213 Deadlock`, porque al guardar el turno la clave foránea también toma las filas de los otros tripulantes.
- `registrarDespacho` vuelve a leer el turno con `FOR UPDATE` después de tomar la ambulancia (`409` si ya no está activo).
- Salida y despacho a la vez: uno de los dos gana y el otro falla. Nunca queda un servicio sin tripulación.

## Auditoría y tiempo real

| Entidad | Acción | Detalle |
| --- | --- | --- |
| `turnos` | `seleccionar_ambulancia` | `ambulanciaId`, `funcion`, `turnoAnteriorId` |
| `turnos` | `salir_ambulancia` | `ambulanciaId`, `funcion`, `turnoSiguienteId` |
| `ambulancias` | `cambiar_estado` | `estadoAnterior`, `estadoNuevo`, `origen: 'tripulacion'` |

Sin eventos nuevos, así que `webSocket/` no cambia: se usan `turno.actualizado` y `ambulancia.actualizada` (central) y `mi_servicio.actualizado` (cada tripulante, también quien sale, con `turno: null`). Si un turno se cierra y sigue otro, la central recibe un `turno.actualizado` por cada uno **sin orden garantizado**.

## Verificación

- `tsc`, `oxlint --type-aware` y Vitest en verde (211 pruebas en total; 20 más que antes, en `seleccion_ambulancia.use-case.spec.ts` y `turno.entity.spec.ts`).
- Prueba HTTP real sobre una **copia temporal** de la BD local (ya eliminada): 54 comprobaciones de permisos, errores, flujo, despacho, cambio de turno y mantenimiento.
- Concurrencia real:
  - 8 conductores a la misma ambulancia: 1 `200` y 7 `409`;
  - 8 paramédicos a esa ambulancia: 3 `200` y 5 `409`;
  - un usuario hacia 2 ambulancias a la vez: queda en una;
  - salida contra despacho: `204` y `409`, coherente;
  - 1.200 peticiones cruzadas de entrar y salir: sin `500`.
  - Después, en la BD: 0 usuarios en dos turnos activos, 0 ambulancias con dos, 0 turnos con dos conductores, 0 ambulancias disponibles sin tripulación completa.
- Eventos: comprobados con un receptor HTTP en lugar del servidor `webSocket/`. **No se probó** la entrega final por socket; los tres eventos ya están en su lista blanca.

## Inconsistencias y riesgos conocidos

1. **Relevo durante un servicio: ya no existe.** Antes la central podía cambiar la tripulación con `PUT /turnos/{id}/integrantes`. Si al conductor se le daña el celular en camino, nadie más puede confirmar la llegada (solo el conductor del turno) y `cancelar` solo aplica en `asignada` y `en_camino`. Ya existía un riesgo parecido sin que la central pudiera confirmar la llegada; ahora tampoco hay relevo. **Pendiente de decisión de negocio.**
2. **Usuario inactivado con turno abierto:** sigue ocupando el cupo hasta que la central cierre el turno. No se cierra automáticamente (igual que antes).
3. **`docs/guia-modulo-ambulancias.md`** indica que crear y editar es solo del administrador; prevalece la regla nueva y se dejó una nota allí.
4. **Una ambulancia en mantenimiento con tripulación:** la central puede ponerla así con gente adentro (igual que antes). La tripulación sigue en el turno y puede salir.
5. **Cierre manual y regreso:** si la central saca una ambulancia a `fuera_servicio` con tripulación completa, debe volver a habilitarla ella; la app no la reactiva.
