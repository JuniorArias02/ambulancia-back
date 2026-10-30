# API de emergencias — guía para frontend

**Base URL (desarrollo):** `http://localhost:3000/api/v1`
**Swagger interactivo:** `http://localhost:3000/api/docs` · **OpenAPI JSON** (para Postman/generadores): `http://localhost:3000/api/docs-json`

Las reglas generales (encabezado `Authorization`, formato de error, `401`, fechas ISO, campos desconocidos → `400`) son las mismas de [`api-usuarios-roles-frontend.md`](api-usuarios-roles-frontend.md#1-reglas-generales).

---

## 1. Permisos

Todos los endpoints de `/emergencias` son para **`administrador` y `despachador`**. Con `paramedico` o `conductor` responden `403`: oculte el módulo para esos roles.

---

## 2. Catálogos (valores fijos)

Úselos en los selects y para mostrar etiquetas. Se **envía el valor**, no el texto.

**Fuente** (`fuente`, obligatoria)

| Valor | Texto sugerido |
| --- | --- |
| `linea_123` | Línea 123 |
| `telefono` | Teléfono |
| `radio` | Radio |
| `app` | Aplicación |

**Tipo de incidente** (`tipoIncidente`, opcional)

| Valor | Texto sugerido |
| --- | --- |
| `accidente_transito` | Accidente de tránsito |
| `caida` | Caída |
| `arma` | Herida por arma |
| `quemadura` | Quemadura |
| `clinico` | Caso clínico |
| `otro` | Otro |

**Prioridad** (`prioridad`, opcional)

| Valor | Texto sugerido | Color |
| --- | --- | --- |
| `roja` | Roja (crítica) | rojo |
| `amarilla` | Amarilla (urgente) | amarillo |
| `verde` | Verde (no urgente) | verde |

**Estado** (`estado`, solo lectura)

| Valor | Texto sugerido | ¿Activa? |
| --- | --- | --- |
| `recibida` | Recibida | sí |
| `despachada` | Despachada | sí |
| `en_atencion` | En atención | sí |
| `cerrada` | Cerrada | no |
| `cancelada` | Cancelada | no |

`despachada`, `en_atencion` y `cerrada` los pone el backend con las asignaciones: al despachar una ambulancia (`despachada`), cuando llega a la escena (`en_atencion`) y cuando termina su último servicio (`cerrada`). Ver [`api-despacho-frontend.md`](api-despacho-frontend.md). **El estado nunca se envía desde el cliente.**

---

## 3. Objeto `Emergencia` (respuesta)

```json
{
  "id": "uuid",
  "numeroEmergencia": "EMG-20261024-0001",
  "fuente": "linea_123",
  "informanteNombre": "Carlos Ruiz",
  "informanteTelefono": "+57 300 123 4567",
  "descripcion": "Choque entre moto y carro, motociclista consciente",
  "tipoIncidente": "accidente_transito",
  "prioridad": "amarilla",
  "direccion": "Calle 72 # 15-20",
  "referenciaLugar": "Frente al centro comercial",
  "coordenadas": { "latitud": 4.6582, "longitud": -74.0571 },
  "numeroVictimas": 2,
  "estado": "recibida",
  "emergenciaPrincipalId": null,
  "recibidaPor": { "id": "uuid", "nombreCompleto": "Laura Gómez" },
  "recibidaEn": "2026-10-24T12:00:03.000Z",
  "cerradaEn": null
}
```

- `numeroEmergencia` lo genera el backend: `EMG-AAAAMMDD-NNNN`, consecutivo por día. Úselo como referencia visible ("Emergencia EMG-20261024-0001").
- Pueden venir en `null`: `informanteNombre`, `informanteTelefono`, `tipoIncidente`, `prioridad`, `direccion`, `referenciaLugar`, `coordenadas`, `numeroVictimas`, `emergenciaPrincipalId`, `recibidaPor` y `cerradaEn`.
- `emergenciaPrincipalId` con valor significa que **es una llamada duplicada** de esa emergencia. Muestre un enlace a la principal.
- `coordenadas` sirve para poner el marcador en el mapa.

---

## 4. Validaciones (para el formulario)

| Campo | Regla |
| --- | --- |
| `fuente` | Obligatoria, valor del catálogo |
| `descripcion` | Obligatoria, de 5 a 5000 caracteres |
| `informanteNombre` | Opcional, máximo 150 |
| `informanteTelefono` | Opcional, 7 a 20 caracteres: dígitos, espacios, `-` y `+` inicial (`/^\+?[0-9\s-]{7,20}$/`) |
| `tipoIncidente`, `prioridad` | Opcionales, valores del catálogo |
| `direccion`, `referenciaLugar` | Opcionales, máximo 255 |
| `latitud` | Opcional, entre -90 y 90, hasta 7 decimales |
| `longitud` | Opcional, entre -180 y 180, hasta 7 decimales |
| `numeroVictimas` | Opcional, entero entre 0 y 500 |

**Ubicación obligatoria:** envíe **la dirección o las coordenadas** (o ambas). Si no envía ninguna → `422` "Indique la dirección o las coordenadas".
**Latitud y longitud van juntas:** si envía solo una → `422` "Envíe la latitud y la longitud juntas". Sugerencia: un mapa donde el despachador hace clic y se llenan las dos.

---

## 5. Endpoints

### Registrar emergencia — `POST /emergencias`

```json
{
  "fuente": "linea_123",
  "informanteNombre": "Carlos Ruiz",
  "informanteTelefono": "+57 300 123 4567",
  "descripcion": "Choque entre moto y carro, motociclista consciente",
  "tipoIncidente": "accidente_transito",
  "prioridad": "amarilla",
  "direccion": "Calle 72 # 15-20",
  "referenciaLugar": "Frente al centro comercial",
  "latitud": 4.6582,
  "longitud": -74.0571,
  "numeroVictimas": 2
}
```

Mínimo válido: `{ "fuente": "radio", "descripcion": "Persona caída en la vía", "direccion": "Carrera 7 # 45-10" }`.

**201**: devuelve la `Emergencia` con `estado: "recibida"`, su `numeroEmergencia` y `recibidaPor` (el usuario conectado).
`400` validación · `422` ubicación faltante o coordenadas incompletas.

> **Flujo recomendado:** justo después de registrar, llame a `GET /emergencias/{id}/posibles-duplicadas`. Si devuelve resultados, muestre el aviso "Puede ser la misma emergencia que…" (ver más abajo).

### Listar emergencias — `GET /emergencias`

Parámetros de consulta, todos opcionales:

| Parámetro | Descripción |
| --- | --- |
| `busqueda` | Busca en número, descripción, dirección, nombre y teléfono del informante (máximo 100) |
| `estado` | Un estado del catálogo |
| `soloActivas` | `true` → solo `recibida`, `despachada` y `en_atencion`. Se ignora si envía `estado` |
| `prioridad` | `roja` \| `amarilla` \| `verde` |
| `tipoIncidente` | Un tipo del catálogo |
| `desde`, `hasta` | Rango de `recibidaEn` en ISO 8601 (por ejemplo, `2026-10-24T00:00:00-05:00`) |
| `pagina` | Desde 1 (por defecto 1) |
| `limite` | De 1 a 100 (por defecto 20) |

Ejemplo (tablero del despachador): `GET /emergencias?soloActivas=true&prioridad=roja`

**200**
```json
{ "datos": [ /* Emergencia[] */ ], "total": 8, "pagina": 1, "limite": 20 }
```

Vienen **de la más reciente a la más antigua**. Total de páginas = `Math.ceil(total / limite)`.

### Obtener una emergencia — `GET /emergencias/{id}`

**200** `Emergencia` · `404` si no existe · `400` si `id` no es un UUID.

### Corregir datos — `PATCH /emergencias/{id}`

Envíe **solo los campos que cambian**. Para **borrar** un dato opcional, envíelo en `null`:

```json
{ "prioridad": "roja", "numeroVictimas": 3, "informanteTelefono": null }
```

- Se puede editar mientras la emergencia esté **activa** (`recibida`, `despachada`, `en_atencion`). Es el endpoint para **re-clasificar la prioridad**.
- Para cambiar las coordenadas, envíe `latitud` y `longitud` juntas (las dos con valor o las dos en `null`).
- `fuente` y `descripcion` no se pueden enviar en `null`.
- **200** `Emergencia`.

| Error | Cuándo |
| --- | --- |
| `404` | No existe |
| `409` | Otro usuario la modificó al mismo tiempo: recargue y vuelva a intentar |
| `422` | Está `cerrada` o `cancelada` ("No se puede editar una emergencia cancelada"), o la ubicación quedó vacía o incompleta |

### Cancelar — `PATCH /emergencias/{id}/cancelar`

```json
{ "motivo": "El informante confirma que ya no necesita ambulancia" }
```

- `motivo` es obligatorio, de 5 a 255 caracteres. Pídalo en un modal de confirmación.
- Solo se puede cancelar si está **`recibida`**. Muestre el botón solo en ese estado.
- **200**: devuelve la `Emergencia` con `estado: "cancelada"` y `cerradaEn`.
- `422` si no está `recibida` · `409` si otro usuario la modificó al mismo tiempo.
- El motivo queda en la auditoría; **no viene en la respuesta**.

### Posibles duplicadas — `GET /emergencias/{id}/posibles-duplicadas`

Busca emergencias **activas** recibidas en las últimas 2 horas que estén **a menos de 500 m** o tengan **la misma dirección** (sin importar mayúsculas, tildes ni signos).

**200**
```json
[
  {
    "emergencia": { /* Emergencia */ },
    "distanciaMetros": 99,
    "criterios": ["cercania", "misma_direccion", "mismo_tipo"]
  }
]
```

- Vienen de la más cercana a la más lejana. `distanciaMetros` es `null` si alguna de las dos no tiene coordenadas.
- `criterios`: `cercania` (≤ 500 m), `misma_direccion` y `mismo_tipo` (mismo tipo de incidente; solo informativo).
- Lista vacía = no hay posibles duplicadas.
- **Son solo sugerencias**: el backend nunca marca una duplicada por su cuenta. El despachador decide.

Texto sugerido: *"Posible duplicado: EMG-20261024-0001 — a 99 m, misma dirección, mismo tipo. [Ver] [Es la misma emergencia]"*.

### Marcar como duplicada — `PATCH /emergencias/{id}/duplicada`

`{id}` es la llamada **repetida**; en el cuerpo va la emergencia que **sí se atiende**:

```json
{ "emergenciaPrincipalId": "uuid de la emergencia original" }
```

- **200**: la emergencia repetida queda `cancelada`, con `emergenciaPrincipalId` y `cerradaEn`.

| Error | Cuándo |
| --- | --- |
| `404` | La emergencia `{id}` no existe |
| `409` | Otro usuario la modificó al mismo tiempo |
| `422` | `{id}` no está `recibida`; la principal no existe, es ella misma, ya es duplicada de otra ("…elija la principal") o está cancelada |

---

## 6. Tipos TypeScript sugeridos

```ts
export type FuenteEmergencia = 'linea_123' | 'telefono' | 'radio' | 'app';
export type TipoIncidente =
  | 'accidente_transito' | 'caida' | 'arma' | 'quemadura' | 'clinico' | 'otro';
export type PrioridadEmergencia = 'roja' | 'amarilla' | 'verde';
export type EstadoEmergencia =
  | 'recibida' | 'despachada' | 'en_atencion' | 'cerrada' | 'cancelada';

export interface Emergencia {
  id: string;
  numeroEmergencia: string;
  fuente: FuenteEmergencia;
  informanteNombre: string | null;
  informanteTelefono: string | null;
  descripcion: string;
  tipoIncidente: TipoIncidente | null;
  prioridad: PrioridadEmergencia | null;
  direccion: string | null;
  referenciaLugar: string | null;
  coordenadas: { latitud: number; longitud: number } | null;
  numeroVictimas: number | null;
  estado: EstadoEmergencia;
  emergenciaPrincipalId: string | null;
  recibidaPor: { id: string; nombreCompleto: string | null } | null;
  recibidaEn: string;
  cerradaEn: string | null;
}

export interface PosibleDuplicada {
  emergencia: Emergencia;
  distanciaMetros: number | null;
  criterios: Array<'cercania' | 'misma_direccion' | 'mismo_tipo'>;
}

export interface Paginado<T> {
  datos: T[];
  total: number;
  pagina: number;
  limite: number;
}
```

---

## 7. Pantallas sugeridas

1. **Tablero de emergencias activas** (`?soloActivas=true`): tarjetas o filas con número, prioridad (color), tipo, dirección, tiempo transcurrido desde `recibidaEn` y estado. Ordene o resalte las `roja`. Botón **Nueva emergencia**.
2. **Formulario de registro**: fuente, informante, descripción, tipo, prioridad, dirección y referencia, un mapa para las coordenadas y el número de víctimas. Al guardar, consulte las posibles duplicadas.
3. **Aviso de posibles duplicadas**: lista con distancia y criterios, y el botón **Es la misma emergencia** (llama a `/duplicada`).
4. **Detalle**: todos los datos, el mapa y quién la recibió. Acciones **Editar** (si está activa) y **Cancelar** (si está `recibida`). Si es duplicada, enlace a la principal.
5. **Historial / búsqueda**: listado con filtros por estado, prioridad, tipo y rango de fechas.

---

## 8. Resumen de endpoints

| Método | Ruta | Uso |
| --- | --- | --- |
| POST | `/emergencias` | Registrar emergencia |
| GET | `/emergencias` | Listar con filtros y paginación |
| GET | `/emergencias/{id}` | Detalle |
| PATCH | `/emergencias/{id}` | Corregir datos / re-clasificar prioridad |
| PATCH | `/emergencias/{id}/cancelar` | Cancelar (solo `recibida`) |
| GET | `/emergencias/{id}/posibles-duplicadas` | Sugerencias de llamadas repetidas |
| PATCH | `/emergencias/{id}/duplicada` | Marcar como duplicada de otra |

Todos: roles `administrador` y `despachador`.
