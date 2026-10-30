# API de ambulancias — guía para frontend

**Base URL (desarrollo):** `http://localhost:3000/api/v1`
**Swagger interactivo:** `http://localhost:3000/api/docs` · **OpenAPI JSON** (para Postman/generadores): `http://localhost:3000/api/docs-json`

Las reglas generales (encabezado `Authorization`, formato de error, `401`, fechas ISO, campos desconocidos → `400`) son las mismas de [`api-usuarios-roles-frontend.md`](api-usuarios-roles-frontend.md#1-reglas-generales).

---

## 1. Permisos por rol

| Acción | administrador | despachador | paramedico / conductor |
| --- | --- | --- | --- |
| Ver tipos, listar, ver detalle e historial | ✅ | ✅ | ❌ `403` |
| Cambiar el estado operativo | ✅ | ✅ | ❌ `403` |
| Registrar y editar ambulancias | ✅ | ❌ `403` | ❌ `403` |

Use el `rol` de la sesión para ocultar los botones **Nueva ambulancia** y **Editar** al despachador, y la pantalla completa a paramédicos y conductores.

---

## 2. Estados operativos

| Valor (`estadoOperativo`) | Texto sugerido | Color sugerido |
| --- | --- | --- |
| `disponible` | Disponible | verde |
| `en_servicio` | En servicio | azul |
| `fuera_servicio` | Fuera de servicio | gris |
| `mantenimiento` | En mantenimiento | naranja |

- **Una ambulancia nueva nace `fuera_servicio`.**
- `en_servicio` **no se puede poner a mano**: lo pone el sistema al despachar la ambulancia a una emergencia y lo quita al finalizar o cancelar el servicio. Nunca lo muestre como opción en el formulario de cambio de estado.
- **Pasar a `disponible` exige un turno activo** (tripulación). Sin turno responde `422`. Ver [`api-despacho-frontend.md`](api-despacho-frontend.md).

### Transiciones permitidas a mano

| Estado actual | Opciones a mostrar en el select |
| --- | --- |
| `disponible` | `fuera_servicio`, `mantenimiento` |
| `fuera_servicio` | `disponible`, `mantenimiento` |
| `mantenimiento` | `disponible`, `fuera_servicio` |
| `en_servicio` | **ninguna**: deshabilite el botón **Cambiar estado** y el botón **Editar** |

```ts
export const TRANSICIONES: Record<EstadoOperativo, EstadoManual[]> = {
  disponible: ['fuera_servicio', 'mantenimiento'],
  fuera_servicio: ['disponible', 'mantenimiento'],
  mantenimiento: ['disponible', 'fuera_servicio'],
  en_servicio: [],
};
```

---

## 3. Tipos de ambulancia (para el select)

### Listar tipos — `GET /tipos-ambulancia`

**200**
```json
[
  { "id": "uuid", "nombre": "TAB", "descripcion": "Transporte Asistencial Básico" },
  { "id": "uuid", "nombre": "TAM", "descripcion": "Transporte Asistencial Medicalizado" }
]
```

**Para el select:** a diferencia de los roles, aquí **sí se envía el `id`** (en `tipoAmbulanciaId`). Muestre `nombre` y `descripcion`, por ejemplo: `TAM — Transporte Asistencial Medicalizado`.

---

## 4. Ambulancias

### Objeto `Ambulancia` (respuesta)

```json
{
  "id": "uuid",
  "codigo": "AMB-01",
  "placa": "ABC123",
  "tipo": { "id": "uuid", "nombre": "TAM", "descripcion": "Transporte Asistencial Medicalizado" },
  "estadoOperativo": "fuera_servicio",
  "ultimaUbicacion": null,
  "creadaEn": "2026-10-24T11:00:00.000Z"
}
```

- `ultimaUbicacion` es `null` por ahora. Cuando exista el GPS vendrá así: `{ "latitud": 4.6097102, "longitud": -74.081749, "registradaEn": "…" }`.
- Para mostrar la placa con formato, use `placa.slice(0, 3) + ' ' + placa.slice(3)` → `ABC 123`.

### Validaciones (para los formularios)

| Campo | Regla |
| --- | --- |
| `codigo` | Obligatorio, de 2 a 30 caracteres: letras, números y guiones. Único. **Se guarda en mayúsculas** (`amb-01` → `AMB-01`) |
| `placa` | Obligatoria, 3 letras y 3 números, con espacio o guion opcional (`ABC123`, `abc 123`, `ABC-123`). Única. **Se guarda sin espacios ni guiones y en mayúsculas** (`ABC123`) |
| `tipoAmbulanciaId` | Obligatorio, `id` de `GET /tipos-ambulancia` |

Regex que puede reutilizar en el frontend:

```ts
export const PATRON_CODIGO = /^[A-Za-z0-9-]{2,30}$/;
export const PATRON_PLACA = /^[A-Za-z]{3}[\s-]?\d{3}$/;
```

> `ABC 123` y `abc-123` cuentan como **la misma placa**: si ya existe una, la API responde `409`.

### Registrar ambulancia — `POST /ambulancias` (administrador)

```json
{ "codigo": "amb-01", "placa": "abc-123", "tipoAmbulanciaId": "uuid" }
```

**201**: devuelve la `Ambulancia` creada, normalizada (`AMB-01`, `ABC123`) y con estado `fuera_servicio`.

| Error | Cuándo | Qué hacer |
| --- | --- | --- |
| `400` | Validación | Mostrar los mensajes en los campos |
| `409` | "Ya existe una ambulancia con ese código" / "…con esa placa" | Mostrarlo en el campo correspondiente |
| `422` | "El tipo de ambulancia no existe" | Recargar el select de tipos |

### Listar ambulancias — `GET /ambulancias`

Parámetros de consulta, todos opcionales:

| Parámetro | Descripción |
| --- | --- |
| `busqueda` | Busca en código o placa (máximo 30 caracteres) |
| `estadoOperativo` | `disponible` \| `en_servicio` \| `fuera_servicio` \| `mantenimiento` |
| `tipoAmbulanciaId` | `id` del tipo |
| `pagina` | Desde 1 (por defecto 1) |
| `limite` | De 1 a 100 (por defecto 20) |

Ejemplo: `GET /ambulancias?busqueda=AMB&estadoOperativo=disponible&pagina=1&limite=20`

> **Búsqueda por placa:** la placa se guarda sin espacios ni guiones. Antes de enviar `busqueda`, quítele los espacios y guiones (`texto.replace(/[\s-]/g, '')`) para que `ABC 123` encuentre `ABC123`.

**200**
```json
{
  "datos": [ /* Ambulancia[] */ ],
  "total": 12,
  "pagina": 1,
  "limite": 20
}
```

Total de páginas = `Math.ceil(total / limite)`. Las ambulancias vienen ordenadas por código.

### Obtener una ambulancia — `GET /ambulancias/{id}`

**200** `Ambulancia` · `404` si no existe · `400` si `id` no es un UUID.

### Editar ambulancia — `PATCH /ambulancias/{id}` (administrador)

Envíe solo los campos que cambian. Todos son opcionales:

```json
{ "codigo": "AMB-02", "placa": "xyz 987", "tipoAmbulanciaId": "uuid" }
```

**200** `Ambulancia`. El estado **no** se cambia aquí; tiene su propio endpoint.

| Error | Cuándo |
| --- | --- |
| `404` | La ambulancia no existe |
| `409` | El código o la placa ya pertenecen a otra ambulancia |
| `422` | La ambulancia está `en_servicio` ("No se puede editar una ambulancia mientras está en servicio") o el tipo no existe |

### Cambiar el estado — `PATCH /ambulancias/{id}/estado` (administrador, despachador)

```json
{ "estado": "disponible", "motivo": "Inicio de turno" }
```

- `estado`: solo `disponible`, `fuera_servicio` o `mantenimiento`. Muestre solo las opciones de la [tabla de transiciones](#transiciones-permitidas-a-mano) según el estado actual.
- `motivo` es obligatorio, de 5 a 255 caracteres, y queda en el historial. Pídalo en un modal de confirmación.
- **200**: devuelve la `Ambulancia` con el nuevo estado. Actualice la fila o la tarjeta con esa respuesta.

| Error | Cuándo | Qué hacer |
| --- | --- | --- |
| `400` | Se envió `en_servicio` o un valor inválido, o el motivo es muy corto | Mostrar el mensaje |
| `404` | La ambulancia no existe | Volver al listado |
| `409` | **Otro usuario cambió el estado al mismo tiempo** ("El estado de la ambulancia cambió mientras tanto; vuelva a consultarla") | Mostrar el aviso, **recargar la ambulancia** con `GET /ambulancias/{id}` y dejar que el usuario vuelva a intentarlo |
| `422` | Transición no permitida ("La ambulancia ya se encuentra disponible" / "No se puede pasar de en_servicio a disponible manualmente") | Mostrar el mensaje y recargar |

### Historial de estados — `GET /ambulancias/{id}/historial-estados`

Parámetros opcionales: `pagina` (por defecto 1) y `limite` (de 1 a 100, por defecto 20).

**200**
```json
{
  "datos": [
    {
      "id": "uuid",
      "estadoAnterior": "fuera_servicio",
      "estadoNuevo": "disponible",
      "motivo": "Inicio de turno",
      "usuarioId": "uuid",
      "cambiadoEn": "2026-10-24T12:30:00.000Z"
    }
  ],
  "total": 1,
  "pagina": 1,
  "limite": 20
}
```

- Viene **del más reciente al más antiguo**. Sirve para una línea de tiempo en el detalle de la ambulancia.
- `estadoAnterior`, `motivo` y `usuarioId` pueden ser `null`.
- `usuarioId` es solo el id. Para mostrar el nombre, el administrador puede usar `GET /usuarios/{id}`; el despachador no tiene acceso a ese endpoint, así que muéstrele solo la fecha, los estados y el motivo.
- `404` si la ambulancia no existe.

---

## 5. Tipos TypeScript sugeridos

```ts
export type EstadoOperativo = 'disponible' | 'en_servicio' | 'fuera_servicio' | 'mantenimiento';
export type EstadoManual = Exclude<EstadoOperativo, 'en_servicio'>;

export interface TipoAmbulancia {
  id: string;
  nombre: string;
  descripcion: string | null;
}

export interface Ambulancia {
  id: string;
  codigo: string;
  placa: string;
  tipo: TipoAmbulancia;
  estadoOperativo: EstadoOperativo;
  ultimaUbicacion: { latitud: number; longitud: number; registradaEn: string } | null;
  creadaEn: string;
}

export interface CambioEstado {
  id: string;
  estadoAnterior: EstadoOperativo | null;
  estadoNuevo: EstadoOperativo;
  motivo: string | null;
  usuarioId: string | null;
  cambiadoEn: string;
}

export interface Paginado<T> {
  datos: T[];
  total: number;
  pagina: number;
  limite: number;
}
```

---

## 6. Pantallas sugeridas

1. **Listado de ambulancias:** tabla o tarjetas con código, placa, tipo y una etiqueta de color para el estado. Filtros: búsqueda, estado y tipo. Botón **Nueva ambulancia** solo para el administrador.
2. **Formulario crear/editar** (administrador): código, placa y select de tipo. En la edición, deshabilítelo si la ambulancia está `en_servicio`.
3. **Modal Cambiar estado** (administrador y despachador): select con las transiciones permitidas y campo de motivo obligatorio.
4. **Detalle:** datos de la ambulancia y la línea de tiempo del historial de estados.

---

## 7. Resumen de endpoints

| Método | Ruta | Rol | Uso |
| --- | --- | --- | --- |
| GET | `/tipos-ambulancia` | administrador, despachador | Opciones del select de tipo |
| POST | `/ambulancias` | administrador | Registrar ambulancia |
| GET | `/ambulancias` | administrador, despachador | Listar con filtros y paginación |
| GET | `/ambulancias/{id}` | administrador, despachador | Detalle |
| PATCH | `/ambulancias/{id}` | administrador | Editar código, placa o tipo |
| PATCH | `/ambulancias/{id}/estado` | administrador, despachador | Cambiar el estado operativo |
| GET | `/ambulancias/{id}/historial-estados` | administrador, despachador | Historial de cambios de estado |
