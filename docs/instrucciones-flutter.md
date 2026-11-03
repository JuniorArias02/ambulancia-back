# selección de ambulancia

## 1. Qué cambió

**Antes:** el despachador asignaba a la persona a una ambulancia y la app esperaba.
**Ahora:** el conductor y el paramédico eligen su ambulancia desde la app.

| Debe cambiar en la app | Detalle |
| --- | --- |
| Pantalla "No está en un turno activo" (`modules/assignments/components/vista_sin_turno.dart`) | Quitar "El despachador debe asignarlo". Pasa a ser, o abre, la **selección de ambulancia** |
| Selección de ambulancia | **Pantalla nueva**, para los dos roles |
| Inicio del conductor y del paramédico | Mostrar si falta tripulación, y la opción **"Salir de la ambulancia"** |
| Entidad del turno (`domain/entities/mi_servicio.dart`) | Agregar `tripulacionCompleta` (`bool`) |

**No cambian:** login, `/mi-servicio` (solo suma ese campo), pasos del servicio, ruta, GPS, historia clínica ni WebSocket.

---

## 2. Autenticación

- Los tres endpoints nuevos exigen `Authorization: Bearer <tokenAcceso>`, igual que los demás. Prefijo: `/api/v1`.
- Solo responden a los roles `conductor` y `paramedico`.
- **El backend obtiene el usuario del token y la función de su rol.** Solo envíe `ambulanciaId`: enviar `funcion`, `usuarioId` o cualquier otro campo responde `400`.
- **Cerrar sesión no libera la ambulancia.** El usuario sigue en ella hasta que salga o la central cierre su turno. Al abrir la app otra vez, `/mi-servicio` devuelve su turno.

---

## 3. El flujo

```
Abrir la app → GET /mi-servicio
  ├─ turno = null            → Pantalla de selección
  │     GET /mi-ambulancia/opciones
  │     El usuario toca una ambulancia
  │     POST /mi-ambulancia
  │       ├─ 200 → guardar el turno e ir al inicio
  │       └─ 409 / 422 → mostrar `mensaje`, recargar opciones
  ├─ turno con tripulacionCompleta = false
  │     → "En AMB-01. Esperando al paramédico / conductor". Puede salir
  ├─ turno completo, asignacion = null
  │     → Inicio actual "en espera". Puede salir
  └─ turno y asignacion      → Servicio en curso. NO puede salir
```

Es igual para los dos roles. Lo que cambia son los cupos: el conductor no puede elegir una ambulancia que ya tenga conductor, y el paramédico sí puede entrar en una con otros paramédicos. El backend ya lo resuelve en `seleccionable`.

**La app no cambia el estado de la ambulancia.** Queda `disponible` sola cuando llegan conductor y paramédico, y `fuera_servicio` si la tripulación queda incompleta.

---

## 4. Endpoints

### 4.1 `GET /mi-ambulancia/opciones`

Toda la flota, ordenada por código. Respuesta `200`, un arreglo (sin paginación):

```json
[
  {
    "id": "bfb61fb7-cb4b-43bc-ae88-bcba9d23c88c",
    "codigo": "AMB-03",
    "placa": "ABC123",
    "tipo": { "id": "uuid", "nombre": "TAB", "descripcion": "Transporte Asistencial Básico" },
    "estadoOperativo": "fuera_servicio",
    "tripulacion": [{ "nombreCompleto": "Pedro Díaz", "funcion": "conductor" }],
    "esMia": false,
    "seleccionable": true,
    "motivoNoSeleccionable": null
  }
]
```

| Campo | Uso |
| --- | --- |
| `seleccionable` | Habilita o deshabilita la opción. **Use este campo**, no repita la regla en la app |
| `esMia` | El usuario ya está en esta ambulancia (`seleccionable` es `false`) |
| `motivoNoSeleccionable` | Por qué está deshabilitada (tabla abajo). `null` si se puede elegir o es la suya |
| `tripulacion` | Quién está ya; vacía si no hay nadie. No incluye ids |
| `estadoOperativo` | `disponible`, `en_servicio`, `fuera_servicio`, `mantenimiento` |

| `motivoNoSeleccionable` | Texto sugerido |
| --- | --- |
| `ya_en_otra_ambulancia` | "Ya está en otra ambulancia" |
| `en_servicio` | "Atendiendo un servicio" |
| `mantenimiento` | "En mantenimiento" |
| `conductor_ocupado` | "Ya tiene conductor" |
| `tripulacion_llena` | "Tripulación completa" |

### 4.2 `POST /mi-ambulancia`

```json
{ "ambulanciaId": "bfb61fb7-cb4b-43bc-ae88-bcba9d23c88c" }
```

Respuesta `200`, el turno:

```json
{
  "id": "e16d4548-a232-45e8-91f5-d0ec009c6408",
  "ambulanciaId": "bfb61fb7-cb4b-43bc-ae88-bcba9d23c88c",
  "ambulanciaCodigo": "AMB-03",
  "inicio": "2026-11-01T18:28:16.932Z",
  "fin": null,
  "estado": "activo",
  "integrantes": [
    { "usuarioId": "uuid", "nombreCompleto": "Pedro Díaz", "funcion": "conductor" },
    { "usuarioId": "uuid", "nombreCompleto": "Ana Gómez", "funcion": "paramedico" }
  ],
  "tripulacionCompleta": true
}
```

- **Se puede reintentar:** repetir con la misma ambulancia devuelve `200` con el mismo turno. Útil si se corta la señal antes de recibir la respuesta.
- Para cambiar de ambulancia: primero `DELETE`, después `POST`. No se cambia directamente.
- **No guarde el `id` del turno como algo fijo.** Puede cambiar cuando alguien entra o sale. Tome siempre el `turno` que llega en `/mi-servicio` o por WebSocket.
- El orden de `integrantes` no está garantizado. Busque por `funcion`.

### 4.3 `DELETE /mi-ambulancia`

Sin cuerpo. Responde `204` sin contenido. Si ya no estaba en ninguna, también `204`: se puede reintentar. Después, `/mi-servicio` trae `turno: null`.

### 4.4 `GET /mi-servicio` (ya existe)

Suma `turno.tripulacionCompleta`. Sin turno:

```json
{ "radioLlegadaMetros": 100, "turno": null, "asignacion": null, "emergencia": null }
```

---

## 5. Errores

Todos con esta forma. **Muestre `mensaje`**, ya viene en español. Con `400` puede ser un arreglo.

```json
{
  "codigoEstado": 409,
  "error": "CONFLICT",
  "mensaje": "La ambulancia ya tiene conductor",
  "ruta": "/api/v1/mi-ambulancia",
  "fecha": "2026-11-01T18:28:18.661Z"
}
```

| Código | Endpoint | `mensaje` | Qué hacer |
| --- | --- | --- | --- |
| `400` | POST | Id inválido o campos de más | Error de programación: revisar el cuerpo |
| `401` | Todos | Sesión inválida o vencida | Flujo normal de sesión vencida |
| `403` | Todos | El rol no es conductor ni paramédico | Cerrar sesión |
| `404` | POST | La ambulancia no existe | Recargar opciones |
| `409` | POST | "Ya está en la ambulancia AMB-01; salga de ella antes de elegir otra" | Recargar `/mi-servicio` |
| `409` | POST | "La ambulancia ya tiene conductor" | Recargar opciones: otra persona ganó el cupo |
| `409` | POST | "La tripulación de la ambulancia ya está completa" | Recargar opciones |
| `409` | POST | "La ambulancia está atendiendo un servicio" | Recargar opciones |
| `422` | POST | "La ambulancia está en mantenimiento" | Recargar opciones |
| `422` | DELETE | "La ambulancia está atendiendo un servicio; finalícelo antes de salir" | Recargar `/mi-servicio` |
| `409` | DELETE | "Su ambulancia cambió mientras tanto; vuelva a consultarla" | Recargar `/mi-servicio` |
| `429` | Todos | Demasiadas peticiones (límite global: 120 por minuto) | Esperar y reintentar |

Dos personas pueden tocar la misma ambulancia al mismo tiempo: la lista puede estar desactualizada, y el `409` es un caso normal. No lo trate como una falla.

---

## 6. Estados de la pantalla

Decida con `/mi-servicio`:

| `turno` | `tripulacionCompleta` | `asignacion` | Pantalla | ¿Salir? |
| --- | --- | --- | --- | --- |
| `null` | — | — | Selección de ambulancia | — |
| con datos | `false` | `null` | "En AMB-01. Falta conductor / paramédico" (sin conductor o sin integrante con otra función) | Sí |
| con datos | `true` | `null` | Inicio "en espera" | Sí |
| con datos | `true` | con datos | Servicio en curso | **No: oculte el botón** |

Pida confirmación antes de salir. Mensaje sugerido: "La ambulancia quedará fuera de servicio si la tripulación queda incompleta".

Una ambulancia recién completada ya está disponible, salvo si la central la dejó en mantenimiento o fuera de servicio.

---

## 7. Tiempo real

No hay eventos nuevos. Siga escuchando `mi_servicio.actualizado`; `datos` tiene la misma forma de `/mi-servicio`:

| Sucede | Quién recibe el evento |
| --- | --- |
| Alguien entra | Todos los de la tripulación, incluido quien entró |
| Alguien sale | Quien salió (con `turno: null`) y los que siguen |
| La central cierra el turno | Todos los que estaban: `turno: null` → volver a selección y avisar |

Se comprobó que el backend publica los eventos de entrar y salir; la entrega por socket y el cierre por la central no se probaron de punta a punta. Pruébelos al integrar.

Con esto, el conductor ve aparecer al paramédico sin recargar. **La lista de opciones no recibe eventos:** recárguela al entrar a la pantalla, al deslizar hacia abajo y después de cada `409` o `422`. Sin WebSocket, use el sondeo de `/mi-servicio` que ya existe.

---

## 8. GPS

`POST /ubicaciones` sigue igual: la ambulancia sale del turno del usuario.

- Empezar a compartir cuando `/mi-servicio` traiga `turno`, también con la tripulación incompleta.
- Detenerse al salir o cuando llegue `turno: null`; sin turno responde `422`.

---

## 9. Pruebas sugeridas

1. Conductor selecciona → "falta paramédico". Paramédico selecciona la misma → los dos pasan a "en espera" sin recargar.
2. Dos conductores tocan la misma ambulancia → uno entra y el otro ve "Ya tiene conductor".
3. Con un servicio asignado → no aparece "Salir".
4. Cerrar sesión y volver a entrar → sigue en su ambulancia.
5. Salir y elegir otra → funciona.
6. La central cierra el turno → la app vuelve a selección.
