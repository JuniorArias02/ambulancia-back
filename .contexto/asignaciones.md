# Módulo de asignaciones (`src/modules/assignments`)

> Contexto general en [00-general.md](00-general.md). Guía para frontend: `docs/api-despacho-frontend.md` (sección 4).

## Qué hace

Despacha ambulancias a emergencias (tabla `asignaciones_servicio`) y lleva el avance del servicio. Es el módulo que **cambia automáticamente** el estado de la ambulancia y de la emergencia.

## Endpoints

| Método | Ruta | Roles | Caso de uso |
| --- | --- | --- | --- |
| POST | `/asignaciones` | admin, despachador | `DespacharAmbulancia` |
| GET | `/asignaciones` | admin, despachador | `ConsultarAsignaciones` (filtros `emergenciaId`, `ambulanciaId`, `estado`, `soloActivas`) |
| GET | `/asignaciones/{id}` | admin, despachador | `ObtenerAsignacion` |
| PATCH | `/asignaciones/{id}/avance` | admin, despachador, conductor, paramédico | `AvanzarAsignacion` |
| PATCH | `/asignaciones/{id}/cancelar` | admin, despachador | `CancelarAsignacion` |
| GET | `/mi-servicio` | conductor, paramédico | `ObtenerMiServicio` (app móvil: turno + asignación activa + emergencia) |

## Entidad `Asignacion`

- Estados: `asignada`, `en_camino`, `en_escena`, `trasladando`, `finalizada`, `cancelada`. Activos: los cuatro primeros.
- Transiciones (`TRANSICIONES_AVANCE`): `asignada → en_camino → en_escena → trasladando → finalizada`; desde `en_escena` también se puede ir directo a `finalizada` (sin traslado).
- Cada paso guarda su fecha:
  - `en_camino` → `salidaEn`;
  - `en_escena` → `llegadaEscenaEn`;
  - `trasladando` → `salidaEscenaEn`;
  - `finalizada` → `finalizadaEn`, y también `llegadaDestinoEn` si venía de `trasladando`.
- `cancelar(motivo)` solo en `asignada` o `en_camino`; guarda `motivoCancelacion` y `finalizadaEn`.
- `Asignacion.siguientesEstados(estado)` → la respuesta trae `siguientesEstados` para pintar los botones.

## Métodos que se agregaron en otras entidades

- `Ambulancia.iniciarServicio()` (`disponible` → `en_servicio`) y `finalizarServicio()` (`en_servicio` → `disponible`).
- `Emergencia.despachar()` (`recibida` → `despachada`; con un despacho adicional queda igual; rechaza duplicadas e inactivas), `iniciarAtencion()` (`despachada` → `en_atencion`), `cerrar()` (`en_atencion` → `cerrada`) y `volverARecibida()` (`despachada` → `recibida`).

## Efectos de cada acción

| Acción | Asignación | Ambulancia (+ historial) | Emergencia |
| --- | --- | --- | --- |
| Despachar | nueva `asignada` (guarda `turnoId` y `asignadaPorId`) | `disponible` → `en_servicio`, motivo "Despachada a EMG-…" | `recibida` → `despachada` |
| Avance `en_escena` | — | — | `despachada` → `en_atencion` |
| Avance `finalizada` | — | `en_servicio` → `disponible`, motivo "Servicio finalizado (EMG-…)" | → `cerrada` si no quedan otras asignaciones activas |
| Cancelar | `cancelada` | `en_servicio` → `disponible`, motivo "Asignación cancelada: …" | sin otras activas: `despachada` → `recibida`, o `en_atencion` → `cerrada` |

## Reglas

0. **Destino del traslado:** lo elige solo el conductor; ver [ruta-institucion.md](ruta-institucion.md).
1. La ambulancia debe estar `disponible`, **con turno activo y tripulación completa** (`422`). Si el turno deja de estar activo durante el despacho, `409`.
2. **Una ambulancia no queda asignada a dos emergencias**: en la transacción, `updateMany` de la ambulancia con `where estadoOperativo = 'disponible'`; si otro despacho ganó, `count = 0` → `409`.
3. Una emergencia **puede tener varias ambulancias**.
4. **Permiso de avance**: administrador y despachador pueden avanzar cualquier asignación; conductor y paramédico, solo la de **su** turno (`turno.incluyeA(usuarioId)`) → si no, `403`.
5. **Todo en una sola transacción** (`PrismaAsignacionesRepositorio.registrarDespacho` / `registrarTransicion`): asignación, ambulancia, historial de la ambulancia y emergencia. Cada fila con control optimista (si cambió, `409`).
6. **Cierre de la emergencia sin carreras**: el caso de uso cuenta las otras asignaciones activas y decide (`sinOtrasAsignacionesActivas`). En la transacción se bloquea la fila de la emergencia (`FOR UPDATE`), se vuelve a contar y, si no coincide, responde `409` "intente de nuevo". Así, dos ambulancias que terminan al mismo tiempo no dejan la emergencia abierta para siempre.
7. Si el estado de la emergencia no cambia, el repositorio no la escribe; solo verifica que siga en el estado leído.
8. Auditoría en `entidad: 'asignaciones_servicio'`:
   - `despachar`: emergencia y ambulancia;
   - `avanzar`: `estadoAnterior`, `estadoNuevo` y `emergenciaCerrada`;
   - `cancelar`: `motivo` y el estado final de la emergencia.

## Dependencias

Importa `AmbulancesModule` (`AmbulanciasRepositorio`, `TurnosRepositorio`), `EmergenciesModule` (`EmergenciasRepositorio`) y `AuditModule`. Exporta `AsignacionesRepositorio` (lo usa `locations`). `MiServicioRespuestaDto` reutiliza `TurnoRespuestaDto` y `EmergenciaRespuestaDto` de los otros módulos.

## Pruebas

- `asignacion.entity.spec.ts` (4 pruebas).
- `flujo_asignacion.use-case.spec.ts` (5 pruebas): flujo completo, ambulancia ocupada, emergencia con dos ambulancias, permiso de la tripulación y cancelación que vuelve la emergencia a `recibida`.
- Doble: `src/modules/assignments/test/dobles/asignaciones_memoria.ts`. Aplica los efectos sobre `AmbulanciasMemoria` y `EmergenciasMemoria`, como lo haría la transacción real.

## Ciclo de atención (2026-10-25)

Ciclo: `asignada → en_camino → en_escena → atendiendo → trasladando → finalizada`. Desde `en_escena` o `atendiendo` también se puede pasar a `finalizada` (cierre sin traslado, con `observacion` obligatoria: `Asignacion.cierreRequiereMotivo`). La etapa nueva `atendiendo` guarda `atencionInicioEn`.

**Llegada (`en_escena`):**
- solo el **conductor del turno** (`PermisoServicio.exigirConductor`, que mira la `funcion` en `turnos_integrantes`); paramédico y central reciben `403`;
- **exige GPS** (`latitud`, `longitud`; `precisionMetros` es opcional) → si falta, `422`;
- `verificarLlegada` (`domain/services/verificacion_llegada.ts`) compara contra `emergencia.coordenadas` con el radio `ASIGNACIONES_RADIO_LLEGADA_M` (100 m por defecto, `ConfiguracionAsignaciones`);
- fuera del radio → `422` "Está a X m… (radio de 100 m)", salvo que venga `confirmarFueraDeRadio: true` + `observacion` → se acepta y se guarda `fueraDeRadio = true`;
- si la emergencia no tiene coordenadas → se acepta sin distancia;
- **nunca se confirma sola**: el radio es solo referencia; `GET /mi-servicio` trae `radioLlegadaMetros` para que la app resalte el botón.

**Registro (`eventos_asignacion`):**
- una fila por paso, con estado anterior y nuevo, `usuarioId`, `rolResponsable`, `ocurridoEn`, posición, precisión, `distanciaEscenaMetros`, `fueraDeRadio` y `observacion`;
- también se registran el despacho (`estadoAnterior` null) y la cancelación (con el motivo);
- se guarda **en la misma transacción** que el cambio de estado (`registrarDespacho` y `registrarTransicion` reciben el evento);
- consulta: `GET /asignaciones/{id}/eventos` (`ConsultarEventosAsignacion`), para la central o la tripulación del turno.

**Duplicados, en tres capas:**
1. Si la asignación ya está en el estado pedido → `200` con el servicio sin cambios (sin evento, auditoría ni aviso).
2. Si hay una carrera (`409` del `updateMany` optimista), se relee: si quedó en el estado pedido, se devuelve sin error.
3. **Restricción única (`asignacion_id`, `estado_nuevo`)** en la BD: el `P2002` se traduce a `409`.

**Responsable y rol:** `ContextoSolicitud` ahora trae `rol` (lo llena `@Contexto()` desde el token). Lo usan el despacho y la cancelación; el avance usa `rolSolicitante`.

**Permisos centralizados:** `application/services/permiso_servicio.service.ts` (`exigirCentralOTripulacion`, `exigirConductor`).

**Tiempo real:** sin cambios. Cada paso ya emite `asignacion.actualizada` con el `estado`; el frontend detecta "paciente a bordo" con `estado === 'trasladando'`.

**Migración** `20261025143827_ciclo_atencion`: columna `asignaciones_servicio.atencion_inicio_en` + tabla `eventos_asignacion` (FK a `asignaciones_servicio` y a `usuarios`, con `SET NULL`).

**Pruebas:** `flujo_asignacion.use-case.spec.ts` (14 escenarios: ciclo completo con responsables, avisos, llegada solo por el conductor, sin GPS, fuera del radio, fuera del radio justificada, sin coordenadas, cierre sin traslado, duplicados, saltos), `asignacion.entity.spec.ts` (+2) y `verificacion_llegada.spec.ts` (3). Total del proyecto: **168**.

**Prueba real (Cúcuta, AMB-02):**
- sin GPS → `422`; paramédica o despachador → `403`; a 1 km → `422` "Está a 1001 m";
- a 50 m → `200`; doble toque → `200`/`200` con un solo evento;
- atendiendo, trasladando y finalizada → `200`, y el WebSocket vio los 5 cambios de estado;
- línea de tiempo con responsables y roles; otra tripulación → `403`.

Guías: `docs/api-ciclo-atencion-app.md` (Flutter) y `docs/api-ciclo-atencion-web.md` (web).

## Pendiente

- Notificar en tiempo real (WebSocket o push) a la tripulación cuando le asignan un servicio. Por ahora, la app consulta `/mi-servicio`.
- Relacionar la historia clínica con la asignación (`historias_clinicas.asignacion_id`).
