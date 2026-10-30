# API de usuarios, roles y autenticación — guía para frontend

**Base URL (desarrollo):** `http://localhost:3000/api/v1`
**Swagger interactivo:** `http://localhost:3000/api/docs` · **OpenAPI JSON** (para Postman/generadores): `http://localhost:3000/api/docs-json`

---

## 1. Reglas generales

- **Autenticación:** todas las rutas, excepto el inicio de sesión, requieren este encabezado:
  ```
  Authorization: Bearer <tokenAcceso>
  ```
- **Un usuario tiene un solo rol.** Los roles son fijos:

  | Valor (`rol`) | Texto sugerido para mostrar |
  | --- | --- |
  | `administrador` | Administrador |
  | `despachador` | Despachador (recibe las alertas) |
  | `paramedico` | Paramédico |
  | `conductor` | Conductor |

- **Permisos:** todos los endpoints de `/usuarios` y `/roles` son **solo para `administrador`**. Con otro rol responden `403`. Use el `rol` de la sesión para ocultar estas pantallas.
- **Campos desconocidos:** si el cuerpo trae campos que el endpoint no espera, la API responde `400`. Envíe solo los campos documentados.
- **Fechas:** se envían y se reciben en ISO 8601 (`2026-10-23T19:09:38.000Z`).
- **Sesión inválida:** cualquier `401` significa que el token expiró, que se cerró la sesión o que el usuario fue bloqueado o inactivado. Limpie el token y redirija al login.

### Formato de error (igual en todos los endpoints)

```json
{
  "codigoEstado": 422,
  "error": "UNPROCESSABLE_ENTITY",
  "mensaje": "No puede cambiar el estado de su propio usuario",
  "ruta": "/api/v1/usuarios/…/estado",
  "fecha": "2026-10-23T19:09:38.000Z"
}
```

En los errores de validación (`400`), `mensaje` es un **arreglo** con un texto por cada campo inválido. Muéstrelos tal cual.

| Código | Significado |
| --- | --- |
| `400` | Datos inválidos (validación) |
| `401` | No autenticado / sesión inválida |
| `403` | El rol no tiene acceso |
| `404` | El recurso no existe |
| `409` | Conflicto (por ejemplo, el correo ya está registrado) |
| `422` | Regla de negocio incumplida (el `mensaje` explica cuál) |
| `429` | Demasiados intentos (login y cambio de contraseña: 5 por minuto) |

---

## 2. Autenticación

### Iniciar sesión — `POST /autenticacion/iniciar-sesion` (pública)

```json
{ "correo": "admin@gmail.com", "contrasena": "JuniorArias02" }
```

**200**
```json
{
  "tokenAcceso": "eyJhbGciOi…",
  "tipoToken": "Bearer",
  "expiraEn": "2026-10-24T03:09:38.000Z",
  "usuario": {
    "id": "uuid",
    "nombres": "Administrador",
    "apellidos": "Sistema",
    "correo": "admin@gmail.com",
    "rol": "administrador"
  }
}
```

- `401` → "Credenciales inválidas". El mensaje es el mismo si el correo no existe, si la contraseña es incorrecta o si el usuario está bloqueado.
- El token dura 8 horas. Use `expiraEn` para cerrar la sesión en el cliente.

### Perfil del usuario actual — `GET /autenticacion/perfil`

**200**: el mismo objeto que `usuario` en el inicio de sesión. Úselo al recargar la app para saber quién está conectado y con qué rol.

### Cerrar sesión — `POST /autenticacion/cerrar-sesion`

Sin cuerpo. **204**: revoca el token actual.

### Cambiar la contraseña propia — `PATCH /autenticacion/contrasena`

```json
{ "contrasenaActual": "…", "contrasenaNueva": "…" }
```

**204**: **cierra todas las sesiones** del usuario, incluida la actual. Después de un 204, redirija al login.
`422` si la contraseña actual es incorrecta o si la nueva es igual a la actual.

---

## 3. Roles (para el select)

### Listar roles — `GET /roles` (administrador)

**200**
```json
[
  { "id": "uuid", "nombre": "administrador", "descripcion": "Administración general del sistema" },
  { "id": "uuid", "nombre": "conductor", "descripcion": "Conduce la ambulancia asignada" },
  { "id": "uuid", "nombre": "despachador", "descripcion": "Recibe las alertas de emergencia y despacha las ambulancias" },
  { "id": "uuid", "nombre": "paramedico", "descripcion": "Atiende al paciente y diligencia la historia clínica" }
]
```

**Para el select:** use `nombre` como **valor** (es lo que se envía en `rol`) y la tabla de la sección 1 o `descripcion` como texto. **No envíe el `id`.**

```tsx
<select name="rol">
  {roles.map((r) => (
    <option key={r.nombre} value={r.nombre}>{etiquetaRol[r.nombre]}</option>
  ))}
</select>
```

---

## 4. Usuarios (solo administrador)

### Objeto `Usuario` (respuesta)

```json
{
  "id": "uuid",
  "nombres": "Laura Marcela",
  "apellidos": "Gómez Pérez",
  "correo": "laura.gomez@ambulanciasgalenos.co",
  "telefono": "+57 300 123 4567",
  "estado": "activo",
  "rol": "despachador",
  "ultimoAcceso": "2026-10-23T19:09:38.000Z",
  "creadoEn": "2026-10-23T18:00:00.000Z"
}
```

- `estado`: `activo` | `inactivo` | `bloqueado`
- `telefono` y `ultimoAcceso` pueden ser `null`.

### Validaciones (para los formularios)

| Campo | Regla |
| --- | --- |
| `nombres`, `apellidos` | Obligatorios, máximo 100 caracteres |
| `correo` | Correo válido, máximo 150 caracteres, único. Se guarda en minúsculas |
| `telefono` | Opcional. 7 a 20 caracteres: dígitos, espacios, `-` y `+` inicial |
| `contrasena` | De 10 a 128 caracteres, con **al menos una letra y un número** |
| `rol` | Uno de: `administrador`, `despachador`, `paramedico`, `conductor` |

### Crear usuario — `POST /usuarios`

```json
{
  "nombres": "Laura Marcela",
  "apellidos": "Gómez Pérez",
  "correo": "laura.gomez@ambulanciasgalenos.co",
  "telefono": "+57 300 123 4567",
  "contrasena": "Secreta2026",
  "rol": "despachador"
}
```

**201**: devuelve el `Usuario` creado, con estado `activo`.
`409` si el correo ya existe (mostrarlo en el campo correo) · `400` si hay errores de validación.

### Listar usuarios — `GET /usuarios`

Parámetros de consulta, todos opcionales:

| Parámetro | Descripción |
| --- | --- |
| `busqueda` | Busca en nombres, apellidos o correo |
| `estado` | `activo` \| `inactivo` \| `bloqueado` |
| `rol` | `administrador` \| `despachador` \| `paramedico` \| `conductor` |
| `pagina` | Desde 1 (por defecto 1) |
| `limite` | De 1 a 100 (por defecto 20) |

Ejemplo: `GET /usuarios?busqueda=laura&rol=despachador&pagina=1&limite=20`

**200**
```json
{
  "datos": [ /* Usuario[] */ ],
  "total": 37,
  "pagina": 1,
  "limite": 20
}
```

Total de páginas = `Math.ceil(total / limite)`. Los usuarios vienen ordenados por apellidos y luego por nombres.

### Obtener un usuario — `GET /usuarios/{id}`

**200** `Usuario` · `404` si no existe · `400` si `id` no es un UUID.

### Editar datos personales — `PATCH /usuarios/{id}`

Envíe solo los campos que cambian. Todos son opcionales:

```json
{ "nombres": "Laura", "apellidos": "Gómez", "telefono": null }
```

`telefono: null` borra el teléfono. **200** `Usuario`.
El correo, el rol, el estado y la contraseña **no** se cambian aquí; cada uno tiene su propio endpoint.

### Cambiar el rol — `PUT /usuarios/{id}/rol`

```json
{ "rol": "paramedico" }
```

**200** `Usuario`. `422` si un administrador intenta quitarse a sí mismo el rol de administrador.

### Activar, inactivar o bloquear — `PATCH /usuarios/{id}/estado`

```json
{ "estado": "bloqueado", "motivo": "Retiro de la empresa" }
```

- `motivo` es obligatorio, de 5 a 255 caracteres, y queda en la auditoría. Pídalo en un modal de confirmación.
- **200** `Usuario`.
- `422` si el usuario ya está en ese estado o si el administrador intenta cambiar su propio estado (oculte la acción para el usuario conectado).
- Bloquear o inactivar a un usuario **lo desconecta de inmediato**.

---

## 5. Resumen de endpoints

| Método | Ruta | Rol | Uso |
| --- | --- | --- | --- |
| POST | `/autenticacion/iniciar-sesion` | pública | Login |
| GET | `/autenticacion/perfil` | cualquiera | Usuario actual |
| POST | `/autenticacion/cerrar-sesion` | cualquiera | Logout |
| PATCH | `/autenticacion/contrasena` | cualquiera | Cambiar contraseña propia |
| GET | `/roles` | administrador | Opciones del select de rol |
| POST | `/usuarios` | administrador | Crear usuario |
| GET | `/usuarios` | administrador | Listar con filtros y paginación |
| GET | `/usuarios/{id}` | administrador | Detalle |
| PATCH | `/usuarios/{id}` | administrador | Editar datos personales |
| PUT | `/usuarios/{id}/rol` | administrador | Cambiar rol |
| PATCH | `/usuarios/{id}/estado` | administrador | Activar / inactivar / bloquear |
