# Verificación de ciudadanos: guía para el frontend web

**Para:** el agente del frontend web (`ambulancia/front`).
**Estado:** el backend está implementado, probado con peticiones HTTP reales y publicado en Swagger (`/api/docs`, sección "Verificación de ciudadanos"). Los ejemplos JSON son respuestas reales.
**Qué falta:** solo las pantallas de la web.

---

## 1. De qué se trata

Los ciudadanos se registran desde la app Flutter y envían dos fotos de su documento (frontal y posterior).

**No pueden reportar emergencias hasta que un administrador revise su identidad y la apruebe.** Ese es el módulo nuevo de la web: una fila de solicitudes donde el administrador:

1. ve los datos del ciudadano, **incluido el número de documento completo**;
2. abre las dos fotos y compara;
3. aprueba, rechaza o pide una corrección.

| Decisión | Efecto en la app del ciudadano |
| --- | --- |
| Aprobar (`verificado`) | Ya puede reportar emergencias |
| Pedir corrección (`requiere_correccion`) | Ve el motivo y reenvía fotos o datos; vuelve a la fila como `pendiente` |
| Rechazar (`rechazado`) | Ve el motivo; no puede reportar. Es **final** |

Aprobar es una revisión documental interna: no certifica la identidad ante terceros.

---

## 2. Permisos

- **Solo `administrador`.** El despachador, el conductor, el paramédico y el ciudadano reciben `403` en todos estos endpoints.
- Ruta y menú visibles solo para `administrador`, igual que "Usuarios": grupo "Administración" de `components/layout/barra_lateral.tsx` y `handle.roles: ['administrador']`.
- Ocultar el menú es solo experiencia de usuario: el backend valida cada solicitud.

---

## 3. Endpoints

Prefijo `/api/v1`, con `Authorization: Bearer <token>` (el cliente `services/api.ts` ya lo pone).

| Método | Ruta | Para qué |
| --- | --- | --- |
| GET | `/verificaciones-ciudadanos` | Fila de solicitudes (filtros y paginación) |
| GET | `/verificaciones-ciudadanos/{usuarioId}` | Detalle: datos, fotos e historial. **Cada consulta queda auditada** |
| GET | `/verificaciones-ciudadanos/{usuarioId}/documentos/{documentoId}` | La imagen de una foto. **Auditada** |
| POST | `/verificaciones-ciudadanos/{usuarioId}/decision` | Tomar, aprobar, rechazar o pedir corrección |

### 3.1 Fila: `GET /verificaciones-ciudadanos`

| Parámetro | Tipo | Detalle |
| --- | --- | --- |
| `estado` | Texto, opcional | `pendiente`, `en_revision`, `verificado`, `rechazado` o `requiere_correccion`. Sin él, todas |
| `busqueda` | Texto, opcional (máx. 100) | Nombres, apellidos, **número de documento** o correo |
| `pagina`, `limite` | Enteros | Por defecto 1 y 20; `limite` máx. 100 |

El orden viene del backend: **primero las que más llevan esperando** (`enviadaEn` ascendente).

```json
{
  "datos": [
    {
      "usuarioId": "6306702a-fa50-48e1-9370-9dd248140697",
      "nombres": "Carlos",
      "apellidos": "Pérez Díaz",
      "tipoDocumento": "CC",
      "numeroDocumento": "88222333",
      "correo": "carlos.ciudadano@prueba.co",
      "telefono": "+57 310 555 1234",
      "estado": "requiere_correccion",
      "enviadaEn": "2026-11-03T03:14:38.749Z",
      "revisadaEn": "2026-11-03T03:14:39.200Z"
    }
  ],
  "total": 1,
  "pagina": 1,
  "limite": 1
}
```

### 3.2 Detalle: `GET /verificaciones-ciudadanos/{usuarioId}`

Trae los mismos campos de la fila, más:

| Campo | Detalle |
| --- | --- |
| `fechaNacimiento` | `AAAA-MM-DD` |
| `estadoCuenta` | `activo`, `inactivo` o `bloqueado` (la cuenta, no la verificación) |
| `registradoEn` | Fecha de creación de la cuenta |
| `motivo` | El último motivo de rechazo o corrección (`null` si no hay) |
| `revisadaPor` | `{ id, nombreCompleto }` del último administrador que decidió, o `null` |
| `documentos` | Las **fotos vigentes**: `{ id, lado, tipoMime, tamanoBytes, cargadoEn }` |
| `historial` | Cada cambio de estado, del más antiguo al más reciente |

```json
{
  "usuarioId": "6306702a-fa50-48e1-9370-9dd248140697",
  "nombres": "Carlos",
  "apellidos": "Pérez Díaz",
  "tipoDocumento": "CC",
  "numeroDocumento": "88222333",
  "correo": "carlos.ciudadano@prueba.co",
  "telefono": "+57 310 555 1234",
  "estado": "requiere_correccion",
  "enviadaEn": "2026-11-03T03:14:38.749Z",
  "revisadaEn": "2026-11-03T03:14:39.200Z",
  "fechaNacimiento": "1985-03-09",
  "estadoCuenta": "activo",
  "registradoEn": "2026-11-03T03:14:38.749Z",
  "motivo": "La foto frontal está cortada; tómela completa",
  "revisadaPor": {
    "id": "93ff17a9-ba1a-439f-8ede-c6e1b6b9610d",
    "nombreCompleto": "Administrador Sistema"
  },
  "documentos": [
    {
      "id": "8b69f2a9-1033-4aa9-b2c5-b14ba7726b6e",
      "lado": "posterior",
      "tipoMime": "image/jpeg",
      "tamanoBytes": 30720,
      "cargadoEn": "2026-11-03T03:14:38.749Z"
    },
    {
      "id": "dfb8e48b-5bb9-4cc2-bb65-96cdce2c6d24",
      "lado": "frontal",
      "tipoMime": "image/jpeg",
      "tamanoBytes": 30720,
      "cargadoEn": "2026-11-03T03:14:38.749Z"
    }
  ],
  "historial": [
    {
      "estadoAnterior": null,
      "estadoNuevo": "pendiente",
      "motivo": null,
      "observaciones": null,
      "responsable": {
        "id": "6306702a-fa50-48e1-9370-9dd248140697",
        "nombreCompleto": "Carlos Pérez Díaz"
      },
      "ocurridoEn": "2026-11-03T03:14:38.749Z"
    },
    {
      "estadoAnterior": "pendiente",
      "estadoNuevo": "requiere_correccion",
      "motivo": "La foto frontal está cortada; tómela completa",
      "observaciones": "Nota interna",
      "responsable": {
        "id": "93ff17a9-ba1a-439f-8ede-c6e1b6b9610d",
        "nombreCompleto": "Administrador Sistema"
      },
      "ocurridoEn": "2026-11-03T03:14:39.200Z"
    }
  ]
}
```

- **El orden de `documentos` no está garantizado.** Ubique cada foto por `lado`, no por posición.
- En el `historial`, el registro inicial y los reenvíos tienen como responsable al propio ciudadano; las decisiones, al administrador.
- **`404`**: el `usuarioId` no corresponde a un ciudadano registrado.
- Cada apertura del detalle se registra en la auditoría. No lo recargue en bucle ni lo precargue para toda la lista: pídalo cuando el administrador abra una solicitud.

### 3.3 Fotos: `GET /verificaciones-ciudadanos/{usuarioId}/documentos/{documentoId}`

- Responde la **imagen binaria** (`image/jpeg` o `image/png`), no JSON.
- **No sirve en `<img src="…">` directo:** exige el header `Authorization`. Pídala con axios como `blob` y muestre una URL temporal:

```ts
export async function obtenerFotoDocumento(usuarioId: string, documentoId: string): Promise<string> {
  const { data } = await api.get<Blob>(
    `/verificaciones-ciudadanos/${encodeURIComponent(usuarioId)}/documentos/${encodeURIComponent(documentoId)}`,
    { responseType: 'blob' },
  );
  return URL.createObjectURL(data);
}
```

- Libere la URL con `URL.revokeObjectURL` al cerrar el detalle o cambiar de solicitud.
- **No guarde las fotos** en la caché persistente de TanStack Query ni en `localStorage`. Tampoco las precargue: cada descarga queda auditada.
- `404`: la foto no existe o no pertenece a ese ciudadano. Conocer un id no basta.

### 3.4 Decisión: `POST /verificaciones-ciudadanos/{usuarioId}/decision`

```json
{
  "decision": "requiere_correccion",
  "motivo": "La foto frontal está cortada; tómela completa",
  "observaciones": "Nota interna"
}
```

| Campo | Obligatorio | Regla |
| --- | --- | --- |
| `decision` | Sí | `en_revision`, `verificado`, `rechazado` o `requiere_correccion` |
| `motivo` | **Sí** con `rechazado` y `requiere_correccion` | Máx. 500. **Lo lee el ciudadano en la app**: escríbalo claro y sin notas internas |
| `observaciones` | No | Máx. 2000. Notas internas; **el ciudadano nunca las ve** |

Responde `200` con el **detalle actualizado**, con la forma de la sección 3.2. Reemplace el detalle en pantalla con esa respuesta.

Transiciones permitidas:

| Estado actual | Decisiones posibles |
| --- | --- |
| `pendiente` | `en_revision`, `verificado`, `rechazado`, `requiere_correccion` |
| `en_revision` | `verificado`, `rechazado`, `requiere_correccion` |
| `requiere_correccion` | Ninguna: se espera el reenvío del ciudadano |
| `verificado` | Ninguna (final) |
| `rechazado` | Ninguna (final) |

**Errores:**

| Código | Cuándo | Qué hacer |
| --- | --- | --- |
| `400` | `decision` inválida, `motivo` de más de 500, campo de más | Revisar el formulario |
| `404` | No es un ciudadano registrado | Volver a la fila |
| `409` | Otro administrador decidió antes | Mensaje "Otro administrador ya revisó esta solicitud" y recargar el detalle |
| `422` | Transición no permitida, o falta el motivo | Mostrar `mensaje` |

Los errores tienen la forma de siempre: `{ codigoEstado, error, mensaje, ruta, fecha }`.

---

## 4. Pantallas sugeridas

Carpeta sugerida, con el mismo patrón de `features/users`: `features/citizen_verifications/` (componentes, hooks, `pages/`, `routes/`, `schemas/`, `services/`, `types/`).

### 4.1 Fila de verificaciones

Ruta `/verificaciones-ciudadanos`, en el menú "Administración" junto a "Usuarios". Nombre sugerido: **"Verificación de ciudadanos"**.

- **Pestañas o filtro de estado**, por defecto **"Pendientes"** (`estado=pendiente`). Opciones: Pendientes, En revisión, Corrección pedida, Verificados, Rechazados, Todas.
- **Buscador:** nombre, documento o correo.
- **Columnas:**
  - nombre completo;
  - **tipo y número de documento, completo** (ej.: `CC 88222333`);
  - correo;
  - teléfono;
  - estado (insignia);
  - "Esperando desde" (`enviadaEn`, relativo: "hace 2 h").
- Clic en la fila → detalle (sección 4.2).
- Paginación con `total`, `pagina` y `limite`.
- Opcional: un contador de pendientes en el menú, con `GET /verificaciones-ciudadanos?estado=pendiente&limite=1` y el campo `total`.

### 4.2 Detalle y revisión

**Diseño recomendado: datos a la izquierda y fotos a la derecha, para comparar a simple vista.**

**Columna de datos** (lo que el administrador debe cotejar con la foto):

| Dato | Cómo mostrarlo |
| --- | --- |
| Tipo y **número de documento** | **Completo, grande y en fuente monoespaciada** (ej.: `CC 88 222 333`, agrupado para leerlo), con botón de copiar. Es el dato principal a validar contra la foto |
| Nombres y apellidos | Tal cual |
| Fecha de nacimiento | `09/03/1985` + edad calculada |
| Correo y teléfono | Tal cual |
| Estado de la cuenta | Insignia (`activo` / `bloqueado`) |
| Registrado y última solicitud | `registradoEn`, `enviadaEn` |

**Columna de fotos:**

- **Frontal y posterior**, cada una con su etiqueta, ubicadas por `lado`.
- **Ampliar** a pantalla completa, con zoom y rotación de 90°: las fotos de celular suelen llegar giradas.
- Mientras cargan: esqueleto. Si una falla (`404`): "No se pudo cargar la foto" y botón de reintentar.

**Acciones** (botones según el estado; ver la tabla de transiciones):

| Botón | Estado en que aparece | Envía |
| --- | --- | --- |
| "Tomar solicitud" | `pendiente` | `{ "decision": "en_revision" }`. Marca que alguien la está revisando |
| **"Aprobar"** (verde) | `pendiente`, `en_revision` | `{ "decision": "verificado" }`. Pida confirmación: "¿Confirma que los datos coinciden con el documento?" |
| "Pedir corrección" (ámbar) | `pendiente`, `en_revision` | Diálogo con `motivo` (obligatorio) y `observaciones` (opcional) |
| "Rechazar" (rojo) | `pendiente`, `en_revision` | Diálogo con `motivo` obligatorio + advertencia: "El rechazo es definitivo" |

- En `requiere_correccion`, `verificado` o `rechazado`: sin botones. Muestre el estado y el `motivo` vigente.
- En el diálogo de motivo, aclare debajo del campo: *"El ciudadano verá este texto en la app."* Debajo de observaciones: *"Solo visible para administradores."*
- Ofrezca **motivos predefinidos** que rellenen el campo (editable):
  - "La foto frontal está borrosa o cortada; tómela de nuevo completa y con buena luz."
  - "La foto posterior está borrosa o cortada; tómela de nuevo completa y con buena luz."
  - "El número de documento no coincide con el de la foto."
  - "El nombre no coincide con el del documento."
  - "La fecha de nacimiento no coincide con la del documento."

**Historial** (debajo): línea de tiempo con fecha, estado anterior → nuevo, motivo, observaciones internas y responsable.

### 4.3 Qué comparar al revisar (texto de ayuda para el administrador)

1. **El número de documento escrito coincide con el de la foto.** El backend lo guarda sin puntos ni espacios: compare solo los dígitos.
2. El nombre y la fecha de nacimiento coinciden.
3. Las dos fotos son del mismo documento, legibles y completas, sin recortes ni reflejos que tapen los datos.
4. Ante cualquier duda, pida corrección en lugar de rechazar: el rechazo es definitivo.

---

## 5. Tipos sugeridos (TypeScript)

```ts
export const ESTADOS_VERIFICACION = ['pendiente', 'en_revision', 'verificado', 'rechazado', 'requiere_correccion'] as const;
export type EstadoVerificacion = (typeof ESTADOS_VERIFICACION)[number];

export type DecisionVerificacion = 'en_revision' | 'verificado' | 'rechazado' | 'requiere_correccion';

export interface VerificacionResumen {
  usuarioId: string;
  nombres: string;
  apellidos: string;
  tipoDocumento: 'CC' | 'CE' | 'PPT' | 'PEP' | 'PA';
  numeroDocumento: string;
  correo: string;
  telefono: string;
  estado: EstadoVerificacion;
  enviadaEn: string;
  revisadaEn: string | null;
}

export interface Responsable {
  id: string;
  nombreCompleto: string | null;
}

export interface VerificacionDetalle extends VerificacionResumen {
  fechaNacimiento: string;
  estadoCuenta: 'activo' | 'inactivo' | 'bloqueado';
  registradoEn: string;
  motivo: string | null;
  revisadaPor: Responsable | null;
  documentos: { id: string; lado: 'frontal' | 'posterior'; tipoMime: string; tamanoBytes: number; cargadoEn: string }[];
  historial: {
    estadoAnterior: EstadoVerificacion | null;
    estadoNuevo: EstadoVerificacion;
    motivo: string | null;
    observaciones: string | null;
    responsable: Responsable;
    ocurridoEn: string;
  }[];
}
```

Textos de los estados:

| Estado | Texto | Color |
| --- | --- | --- |
| `pendiente` | Pendiente | Gris o azul |
| `en_revision` | En revisión | Azul |
| `requiere_correccion` | Corrección pedida | Ámbar |
| `verificado` | Verificado | Verde |
| `rechazado` | Rechazado | Rojo |

---

## 6. Ajustes relacionados en módulos existentes

Son cambios pequeños, pero la web los necesita por el rol nuevo:

1. **Rol `ciudadano` en `types/rol.types.ts`.** Agréguelo **solo para mostrar**: `GET /usuarios` ya devuelve ciudadanos, y la insignia de rol, la tabla y los filtros deben reconocerlo.
2. **No ofrezca `ciudadano` en los formularios de crear usuario ni de cambiar rol.** El backend lo rechaza: `400` al crear o asignar ese rol, y `422` si intenta convertir a un ciudadano en personal. Separe una lista `ROLES_INTERNOS` (`administrador`, `despachador`, `paramedico`, `conductor`) para esos selects.
3. **Opcional:** en la lista de usuarios, un enlace "Ver verificación" para las filas con rol `ciudadano`, que abra `/verificaciones-ciudadanos` con ese `usuarioId`.
4. **Bloquear cuentas abusivas:** ya funciona con el endpoint existente `PATCH /usuarios/{id}/estado` (`bloqueado`). No necesita nada nuevo.
5. **Emergencias que reporta un ciudadano** (vista del despachador). Las respuestas de emergencia traen dos campos nuevos:
   - `informanteUsuarioId`: `uuid` si la reportó un ciudadano verificado desde la app, o `null`;
   - `origenUbicacion`: `"gps"` o `"manual"` (marcado en el mapa), o `null`.

   Esos reportes llegan con `fuente: "app"`, `prioridad: null`, `recibidaPor: null` y estado `recibida`. Sugerencias:
   - una insignia "Reportado por ciudadano verificado";
   - "Ubicación por GPS" o "Ubicación marcada a mano" junto al punto en el mapa;
   - resaltar que **la prioridad la define el despachador**.

   El despacho sigue igual que siempre.

---

## 7. Seguridad y datos personales

- **Las fotos y el número de documento son datos personales sensibles.** Solo deben aparecer en este módulo.
- No los lleve a logs, analítica, mensajes de error ni a la URL. La URL solo debe tener el `usuarioId`.
- Las URLs `blob:` de las fotos se liberan al salir del detalle.
- No permita descargar ni imprimir las fotos desde la interfaz, salvo que se defina una política para ello.
- El backend ya audita cada apertura del detalle y cada foto vista. No hace falta registrar nada desde la web.

---

## 8. Pruebas sugeridas

1. Con un usuario despachador, el menú y la ruta no aparecen; si se fuerza la URL, la API responde `403`.
2. La fila abre en "Pendientes", ordenada de la más antigua a la más reciente; la búsqueda por número de documento funciona.
3. En el detalle se ve el **número de documento completo** y las dos fotos, ubicadas por `lado`, con zoom y rotación.
4. "Pedir corrección" sin motivo no se envía; con motivo, el estado pasa a "Corrección pedida" y el historial suma una fila.
5. "Aprobar" pide confirmación y deja el estado en "Verificado", sin más botones.
6. "Rechazar" advierte que es definitivo.
7. Dos pestañas sobre la misma solicitud: la segunda decisión recibe `409` y la pantalla se recarga.
8. En "Usuarios", los ciudadanos aparecen con su insignia, pero `ciudadano` no está en los selects de crear o cambiar rol.
