# API de despacho — turnos, asignaciones, ubicaciones e instituciones (guía para frontend)

**Base URL (desarrollo):** `http://localhost:3000/api/v1`
**Swagger interactivo:** `http://localhost:3000/api/docs` · **OpenAPI JSON** (para Postman/generadores): `http://localhost:3000/api/docs-json`

Las reglas generales (encabezado `Authorization`, formato de error, `401`, fechas ISO, campos desconocidos → `400`) son las mismas de [`api-usuarios-roles-frontend.md`](api-usuarios-roles-frontend.md#1-reglas-generales).

Complementa a [`api-ambulancias-frontend.md`](api-ambulancias-frontend.md) y [`api-emergencias-frontend.md`](api-emergencias-frontend.md).

---

> **Cambio (2026-11-01):** la central ya no arma tripulaciones. `POST /turnos` y `PUT /turnos/{id}/integrantes` no existen y lo que diga la sección 3 sobre ellos ya no aplica. Ver [`instrucciones-agente-frontend.md`](instrucciones-agente-frontend.md).

## 1. El flujo completo (cómo encaja todo)

```text
1. Turno          POST /turnos                       → la ambulancia tiene tripulación
2. Habilitar      PATCH /ambulancias/{id}/estado      → disponible (exige turno activo)
3. Emergencia     POST /emergencias                   → recibida
4. Despachar      POST /asignaciones                  → asignación "asignada"
                                                         ambulancia → en_servicio
                                                         emergencia → despachada
5. Avance         PATCH /asignaciones/{id}/avance     → en_camino → en_escena → (trasladando →) finalizada
                                                         al llegar a la escena: emergencia → en_atencion
                                                         al finalizar: ambulancia → disponible
                                                                       emergencia → cerrada (si era su último servicio)
6. Fin de turno   PATCH /turnos/{id}/finalizar        → si la ambulancia estaba disponible, queda fuera_servicio
```

**El backend cambia solo los estados de la ambulancia y de la emergencia.** El frontend nunca los envía en estos flujos; después de cada acción, actualice la pantalla con la respuesta o vuelva a consultar.

### Permisos

| Recurso | administrador | despachador | conductor / paramédico |
| --- | --- | --- | --- |
| Turnos (todo) | ✅ | ✅ | ❌ |
| Despachar, listar, ver y cancelar asignaciones | ✅ | ✅ | ❌ |
| Marcar el avance de una asignación | ✅ (cualquiera) | ✅ (cualquiera) | ✅ **solo la de su turno** |
| Ver recorrido GPS | ✅ | ✅ | ❌ |
| Reportar GPS, `GET /mi-servicio` | ❌ | ❌ | ✅ (app móvil) |
| Instituciones: listar y ver | ✅ | ✅ | ✅ |
| Instituciones: crear, editar, activar | ✅ | ❌ | ❌ |

---

## 2. Cambio en ambulancias: "disponible" exige turno

`PATCH /ambulancias/{id}/estado` con `"estado": "disponible"` ahora responde **`422` "La ambulancia no tiene un turno activo; inicie un turno antes de habilitarla"** si la ambulancia no tiene turno. Muestre el aviso y ofrezca el botón **Iniciar turno**.

---

## 3. Turnos

Un turno es la tripulación que va en una ambulancia: **un conductor y al menos un paramédico o médico** (máximo 4 personas).

### Catálogos

| `funcion` | Texto | Rol del usuario que puede cumplirla |
| --- | --- | --- |
| `conductor` | Conductor | `conductor` |
| `paramedico` | Paramédico | `paramedico` |
| `medico` | Médico | `paramedico` |

| `estado` | Texto |
| --- | --- |
| `activo` | Activo |
| `finalizado` | Finalizado |

### Objeto `Turno`

```json
{
  "id": "uuid",
  "ambulanciaId": "uuid",
  "ambulanciaCodigo": "AMB-01",
  "inicio": "2026-10-24T13:00:00.000Z",
  "fin": null,
  "estado": "activo",
  "integrantes": [
    { "usuarioId": "uuid", "nombreCompleto": "Pedro Díaz", "funcion": "conductor" },
    { "usuarioId": "uuid", "nombreCompleto": "Ana Rojas", "funcion": "paramedico" }
  ]
}
```

### Iniciar turno — `POST /turnos`

```json
{
  "ambulanciaId": "uuid",
  "integrantes": [
    { "usuarioId": "uuid-conductor", "funcion": "conductor" },
    { "usuarioId": "uuid-paramedico", "funcion": "paramedico" }
  ]
}
```

**Para armar el formulario:** cargue los conductores con `GET /usuarios?rol=conductor&estado=activo` y los paramédicos con `GET /usuarios?rol=paramedico&estado=activo` (solo administrador; ver la guía de usuarios). Para saber quién ya está ocupado, use `GET /turnos?estado=activo`.

**201** `Turno`. El turno **no** habilita la ambulancia: luego hay que pasarla a `disponible`.

| Error | Cuándo |
| --- | --- |
| `400` | Menos de 2 o más de 4 integrantes, `funcion` inválida |
| `404` | La ambulancia no existe |
| `409` | La ambulancia ya tiene un turno activo, o un tripulante ya está en el turno activo de otra ambulancia ("Pedro Díaz ya está en el turno activo de AMB-02") |
| `422` | Falta el conductor o el paramédico/médico, una persona repetida, usuario inexistente o inactivo, o el rol no permite esa función ("Ana Rojas tiene rol paramedico y no puede ir como conductor") |

### Listar turnos — `GET /turnos`

Filtros opcionales: `ambulanciaId`, `usuarioId` (turnos de un tripulante), `estado` (`activo` \| `finalizado`), `pagina`, `limite`. Orden: del más reciente al más antiguo.

Ejemplo (tablero de tripulaciones del día): `GET /turnos?estado=activo&limite=100`.

**200** `{ datos: Turno[], total, pagina, limite }`.

### Obtener turno — `GET /turnos/{id}`

**200** `Turno` · `404`.

### Cambiar la tripulación — `PUT /turnos/{id}/integrantes`

Reemplaza la lista completa (por ejemplo, un relevo del conductor). Mismas reglas que al iniciar.

```json
{ "integrantes": [ { "usuarioId": "uuid", "funcion": "conductor" }, { "usuarioId": "uuid", "funcion": "medico" } ] }
```

**200** `Turno` · `422` si el turno está finalizado.

### Finalizar turno — `PATCH /turnos/{id}/finalizar`

Sin cuerpo. **200** `Turno` con `estado: "finalizado"` y `fin`.

- Si la ambulancia estaba `disponible`, pasa sola a `fuera_servicio`, y en su historial queda el motivo "Fin de turno".
- `422` si la ambulancia está `en_servicio` ("…finalícelo antes de cerrar el turno") o si el turno ya estaba finalizado.

---

## 4. Asignaciones (despacho)

> **Actualizado (2026-10-25): ciclo de atención.** Hay una etapa nueva, `atendiendo`, entre `en_escena` y `trasladando`. La llegada (`en_escena`) **solo la confirma el conductor desde la app, con GPS**. Cerrar sin traslado exige `observacion`. Cada paso queda registrado con su responsable en `GET /asignaciones/{id}/eventos`. Ver **[`api-ciclo-atencion-web.md`](api-ciclo-atencion-web.md)**; lo de esta sección sobre estados y avance queda reemplazado por esa guía.

Una asignación es **una ambulancia enviada a una emergencia**. Una emergencia puede tener varias (por ejemplo, varias víctimas).

### Estados

| `estado` | Texto sugerido | ¿Activa? |
| --- | --- | --- |
| `asignada` | Asignada | sí |
| `en_camino` | En camino | sí |
| `en_escena` | En la escena | sí |
| `trasladando` | Trasladando paciente | sí |
| `finalizada` | Finalizada | no |
| `cancelada` | Cancelada | no |

```text
asignada → en_camino → en_escena → trasladando → finalizada
                                └──────────────→ finalizada   (sin traslado)
asignada / en_camino → cancelada
```

### Objeto `Asignacion`

```json
{
  "id": "uuid",
  "emergenciaId": "uuid",
  "numeroEmergencia": "EMG-20261024-0004",
  "ambulanciaId": "uuid",
  "ambulanciaCodigo": "AMB-01",
  "turnoId": "uuid",
  "estado": "en_escena",
  "siguientesEstados": ["trasladando", "finalizada"],
  "motivoCancelacion": null,
  "asignadaPor": { "id": "uuid", "nombreCompleto": "Laura Gómez" },
  "asignadaEn": "2026-10-24T14:30:00.000Z",
  "salidaEn": "2026-10-24T14:31:10.000Z",
  "llegadaEscenaEn": "2026-10-24T14:42:05.000Z",
  "salidaEscenaEn": null,
  "llegadaDestinoEn": null,
  "finalizadaEn": null
}
```

- **`siguientesEstados`**: los botones que debe mostrar ahora. Si viene vacío, no hay acciones.
- Las fechas de cada paso sirven para una **línea de tiempo** y para calcular tiempos de respuesta (por ejemplo, `llegadaEscenaEn - asignadaEn`).
- `llegadaDestinoEn` se llena al finalizar desde `trasladando` (entrega del paciente).

### Despachar — `POST /asignaciones`

```json
{ "emergenciaId": "uuid", "ambulanciaId": "uuid" }
```

**Para elegir la ambulancia:** `GET /ambulancias?estadoOperativo=disponible`. Cada ambulancia trae `ultimaUbicacion`, así que puede mostrarlas en el mapa junto a la emergencia y elegir la más cercana.

**201** `Asignacion` en estado `asignada`. La ambulancia queda `en_servicio` y la emergencia `despachada` (si estaba `recibida`).

| Error | Cuándo |
| --- | --- |
| `404` | La emergencia o la ambulancia no existen |
| `409` | Otro despachador tomó la ambulancia o cambió la emergencia al mismo tiempo: recargue la lista |
| `422` | La ambulancia no está disponible ("La ambulancia AMB-01 no está disponible (en_servicio)") o no tiene turno; la emergencia está cerrada, cancelada o es duplicada |

### Listar — `GET /asignaciones`

Filtros opcionales: `emergenciaId`, `ambulanciaId`, `estado`, `soloActivas=true`, `pagina`, `limite`. Orden: de la más reciente a la más antigua.

- Servicios de una emergencia (en su detalle): `GET /asignaciones?emergenciaId={id}`.
- Tablero de servicios en curso: `GET /asignaciones?soloActivas=true`.

### Obtener — `GET /asignaciones/{id}`

**200** `Asignacion` · `404`.

### Marcar avance — `PATCH /asignaciones/{id}/avance`

```json
{ "estado": "en_camino" }
```

Valores: `en_camino`, `en_escena`, `trasladando`, `finalizada`. **No se pueden saltar pasos.**

Normalmente lo marca la tripulación desde la app móvil; en la web, el despachador puede marcarlo por ella (por ejemplo, si avisan por radio).

**200** `Asignacion`. Efectos automáticos:
- `en_escena` → la emergencia pasa a `en_atencion` (si estaba `despachada`).
- `finalizada` → la ambulancia vuelve a `disponible` y la emergencia pasa a `cerrada` si no le quedan otros servicios activos.

| Error | Cuándo |
| --- | --- |
| `403` | Un conductor o paramédico que no es de ese turno |
| `409` | Alguien la actualizó al mismo tiempo: recargue |
| `422` | Transición no permitida ("No se puede pasar de asignada a en_escena") |

### Cancelar — `PATCH /asignaciones/{id}/cancelar`

```json
{ "motivo": "Se envía otra ambulancia más cercana" }
```

- `motivo` es obligatorio, de 5 a 255 caracteres, y **sí viene en la respuesta** (`motivoCancelacion`).
- Solo en `asignada` o `en_camino`. Una vez en la escena, se **finaliza**.
- **200** `Asignacion` cancelada. La ambulancia vuelve a `disponible`. Si era el único servicio de la emergencia, esta **vuelve a `recibida`** para despachar otra ambulancia.
- `422` si ya está en escena, finalizada o cancelada.

---

## 5. Ubicaciones (GPS)

### Mapa en vivo (web)

No necesita un endpoint nuevo: **`GET /ambulancias`** trae `ultimaUbicacion` (`{ latitud, longitud, registradaEn }`) de cada ambulancia, y se actualiza con cada reporte del celular. Por ahora, consulte cada 10–15 segundos (más adelante habrá WebSocket).

Sugerencia: si `registradaEn` tiene más de 2–3 minutos, muestre el marcador en gris ("sin señal").

### Recorrido — `GET /ubicaciones` (administrador, despachador)

| Parámetro | Descripción |
| --- | --- |
| `asignacionId` | Recorrido de un servicio (lo más común) |
| `ambulanciaId` | Recorrido de una ambulancia |
| `desde`, `hasta` | Rango de fechas ISO 8601 |
| `limite` | Últimos N puntos, de 1 a 2000 (por defecto 500) |

Debe enviar **`asignacionId` o `ambulanciaId`**; si no, responde `422`.

**200** (en orden cronológico, listo para dibujar una línea):
```json
[
  { "id": "uuid", "ambulanciaId": "uuid", "asignacionId": "uuid", "latitud": 4.68, "longitud": -74.065, "velocidad": 45, "registradaEn": "2026-10-24T14:35:20.000Z" }
]
```

### Reportar posición — `POST /ubicaciones` (solo app móvil)

Lo usa la app Flutter de la tripulación; la web no lo llama. Se documenta aquí para que esté completo.

```json
{ "latitud": 4.6582, "longitud": -74.0571, "velocidad": 45, "registradaEn": "2026-10-24T14:35:20.000Z" }
```

`velocidad` y `registradaEn` son opcionales. La ambulancia sale del turno activo de quien reporta. Responde `422` si el usuario no está en un turno.

---

## 6. Instituciones de salud

Hospitales y clínicas a donde se traslada al paciente. **No se borran**: se inactivan.

### Objeto `InstitucionSalud`

```json
{
  "id": "uuid",
  "nombre": "Hospital Universitario San Ignacio",
  "codigoHabilitacion": "110010612301",
  "nivelComplejidad": "alta",
  "telefono": "+57 601 594 6161",
  "direccion": "Carrera 7 # 40-62",
  "coordenadas": { "latitud": 4.6283, "longitud": -74.0644 },
  "activa": true
}
```

`nivelComplejidad`: `baja` | `mediana` | `alta`. Pueden venir en `null`: `codigoHabilitacion`, `nivelComplejidad`, `telefono`, `direccion` y `coordenadas`.

### Validaciones

| Campo | Regla |
| --- | --- |
| `nombre` | Obligatorio, máximo 180 |
| `codigoHabilitacion` | Opcional, máximo 50, **único** (código REPS) |
| `nivelComplejidad` | Opcional: `baja`, `mediana` o `alta` |
| `telefono` | Opcional: dígitos, espacios, `-` y `+` inicial (7 a 20) |
| `direccion` | Opcional, máximo 255 |
| `latitud` / `longitud` | Opcionales, **juntas** (-90..90 / -180..180) |

### Endpoints

| Método | Ruta | Rol | Uso |
| --- | --- | --- | --- |
| POST | `/instituciones-salud` | administrador | Crear (nace activa). `409` si el código ya existe |
| GET | `/instituciones-salud` | todos | Listar. Filtros: `busqueda` (nombre, código, dirección), `activa`, `nivelComplejidad`, `pagina`, `limite` |
| GET | `/instituciones-salud/{id}` | todos | Detalle |
| PATCH | `/instituciones-salud/{id}` | administrador | Editar solo lo que cambia; `null` borra un dato opcional |
| PATCH | `/instituciones-salud/{id}/estado` | administrador | `{ "activa": false }` para inactivar y `true` para activar. `422` si ya estaba en ese estado |

**Ordenar por cercanía:** si envía `latitud` y `longitud` en el `GET`, vienen **de la más cercana a la más lejana** y cada una trae `distanciaMetros` (en línea recta). Las que no tienen coordenadas van al final. Sin coordenadas, se ordenan por nombre.

`GET /instituciones-salud?activa=true&latitud=4.69&longitud=-74.07` →
```json
{ "datos": [ { "nombre": "Clínica del Country", "distanciaMetros": 2900, "...": "..." } ], "total": 3, "pagina": 1, "limite": 20 }
```

---

## 7. Tipos TypeScript sugeridos

```ts
export type FuncionTripulante = 'conductor' | 'paramedico' | 'medico';
export type EstadoTurno = 'activo' | 'finalizado';

export interface Turno {
  id: string;
  ambulanciaId: string;
  ambulanciaCodigo: string | null;
  inicio: string;
  fin: string | null;
  estado: EstadoTurno;
  integrantes: { usuarioId: string; nombreCompleto: string | null; funcion: FuncionTripulante }[];
}

export type EstadoAsignacion =
  | 'asignada' | 'en_camino' | 'en_escena' | 'trasladando' | 'finalizada' | 'cancelada';
export type EstadoAvance = 'en_camino' | 'en_escena' | 'trasladando' | 'finalizada';

export interface Asignacion {
  id: string;
  emergenciaId: string;
  numeroEmergencia: string | null;
  ambulanciaId: string;
  ambulanciaCodigo: string | null;
  turnoId: string | null;
  estado: EstadoAsignacion;
  siguientesEstados: EstadoAvance[];
  motivoCancelacion: string | null;
  asignadaPor: { id: string; nombreCompleto: string | null } | null;
  asignadaEn: string;
  salidaEn: string | null;
  llegadaEscenaEn: string | null;
  salidaEscenaEn: string | null;
  llegadaDestinoEn: string | null;
  finalizadaEn: string | null;
}

export interface PuntoRecorrido {
  id: string;
  ambulanciaId: string;
  asignacionId: string | null;
  latitud: number;
  longitud: number;
  velocidad: number | null;
  registradaEn: string;
}

export type NivelComplejidad = 'baja' | 'mediana' | 'alta';

export interface InstitucionSalud {
  id: string;
  nombre: string;
  codigoHabilitacion: string | null;
  nivelComplejidad: NivelComplejidad | null;
  telefono: string | null;
  direccion: string | null;
  coordenadas: { latitud: number; longitud: number } | null;
  activa: boolean;
  distanciaMetros?: number | null;
}
```

---

## 8. Pantallas sugeridas (web)

1. **Tripulaciones del día** (`GET /turnos?estado=activo`): tarjeta por ambulancia con su tripulación. Acciones: **Iniciar turno**, **Cambiar tripulación** y **Finalizar turno**.
2. **Centro de despacho**: mapa con las emergencias activas (`GET /emergencias?soloActivas=true`) y las ambulancias (`GET /ambulancias`, marcador por `ultimaUbicacion` y color por estado). Al elegir una emergencia `recibida`, lista de ambulancias `disponible` y botón **Despachar**.
3. **Servicios en curso** (`GET /asignaciones?soloActivas=true`): número de emergencia, ambulancia, estado y tiempo desde `asignadaEn`. Botones según `siguientesEstados`, más **Cancelar** si está `asignada` o `en_camino`.
4. **Detalle de emergencia**: agregue la sección "Servicios" (`GET /asignaciones?emergenciaId=`) con la línea de tiempo de cada uno y el recorrido en el mapa (`GET /ubicaciones?asignacionId=`).
5. **Instituciones de salud** (administrador): CRUD con mapa para las coordenadas y el interruptor de activa.

---

## 9. Resumen de endpoints nuevos

| Método | Ruta | Rol | Uso |
| --- | --- | --- | --- |
| POST | `/turnos` | admin, despachador | Iniciar turno |
| GET | `/turnos` | admin, despachador | Listar turnos |
| GET | `/turnos/{id}` | admin, despachador | Detalle |
| PUT | `/turnos/{id}/integrantes` | admin, despachador | Cambiar la tripulación |
| PATCH | `/turnos/{id}/finalizar` | admin, despachador | Finalizar turno |
| POST | `/asignaciones` | admin, despachador | Despachar ambulancia |
| GET | `/asignaciones` | admin, despachador | Listar asignaciones |
| GET | `/asignaciones/{id}` | admin, despachador | Detalle |
| PATCH | `/asignaciones/{id}/avance` | admin, despachador, tripulación del turno | Marcar avance |
| PATCH | `/asignaciones/{id}/cancelar` | admin, despachador | Cancelar |
| GET | `/ubicaciones` | admin, despachador | Recorrido GPS |
| POST | `/ubicaciones` | conductor, paramédico | Reportar GPS (app móvil) |
| GET | `/mi-servicio` | conductor, paramédico | Turno y servicio actual (app móvil) |
| POST | `/instituciones-salud` | admin | Crear institución |
| GET | `/instituciones-salud` | todos | Listar (por nombre o por cercanía) |
| GET | `/instituciones-salud/{id}` | todos | Detalle |
| PATCH | `/instituciones-salud/{id}` | admin | Editar |
| PATCH | `/instituciones-salud/{id}/estado` | admin | Activar / inactivar |
