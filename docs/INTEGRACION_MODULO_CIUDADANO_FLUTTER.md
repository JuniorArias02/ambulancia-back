# Módulo ciudadano

## A. Contexto del módulo

**Objetivo:** dentro de la **misma app** que usan conductores y paramédicos, el ciudadano puede:

- registrarse y enviar las fotos de su documento;
- esperar la verificación;
- usar el mapa y reportar emergencias;
- consultar sus reportes y su perfil.

La experiencia depende del `rol` de la sesión.

| `rol` | Experiencia en la app |
| --- | --- |
| `conductor` | La actual (sin cambios) |
| `paramedico` | La actual (sin cambios) |
| `ciudadano` | **El módulo de esta guía** |
| `administrador`, `despachador` | No entran a la app (como hasta ahora) |

**Lo que el ciudadano puede hacer:**

| Acción | Condición |
| --- | --- |
| Registrarse | Sin sesión |
| Iniciar sesión, ver su perfil y el estado de verificación | Cualquier estado de verificación |
| Cambiar correo y teléfono | Cualquier estado |
| Reenviar fotos o corregir datos | Solo en `requiere_correccion` |
| Usar el mapa y ver la dirección de un punto | Con sesión (ver sección E) |
| **Reportar una emergencia** | **Solo en `verificado`** |
| Ver sus reportes | Con sesión |

**Lo que el ciudadano nunca puede hacer:** el backend responde `403`, y no existe ningún endpoint para hacerlo.

- elegir o despachar ambulancias;
- definir la prioridad o el estado de una emergencia;
- ver reportes de otros ciudadanos;
- aprobar su propia identidad;
- ver ambulancias, turnos o historias clínicas;
- entrar a funciones administrativas.

La autorización está en el backend. Ocultar botones en la app es solo experiencia de usuario, no seguridad.

**Aviso obligatorio en la app:** en el registro, mientras la cuenta no esté verificada y en la pantalla de reporte, muestre siempre: *"Si la emergencia requiere atención inmediata, llame a la línea 123."* Un reporte en la app **no** equivale a una ambulancia despachada: la central lo revisa primero.

---

## L. Configuración

| Tema | Valor |
| --- | --- |
| URL base | `API_BASE_URL`, el mismo `--dart-define` que ya usa la app (ej.: `http://192.168.x.x:3000/api/v1`) |
| Autenticación | `Authorization: Bearer <tokenAcceso>` en todo, salvo el registro y el login |
| JSON | `Content-Type: application/json` |
| Multipart | `multipart/form-data` en registro y reenvío (Dio `FormData` + `MultipartFile`) |
| Fechas que envía | Fecha de nacimiento: `AAAA-MM-DD` (sin hora). Filtros: ISO 8601 |
| Fechas que recibe | ISO 8601 en UTC (`2026-11-03T03:14:38.749Z`); conviértalas a hora local para mostrarlas |
| Paginación | `?pagina=1&limite=20` (`limite` máx. 100). Responde `{ datos, total, pagina, limite }` |
| Variables nuevas en la app | Ninguna |

No guarde ni muestre secretos. El token va en almacenamiento seguro, como ya hace la app.

---

## D. Autenticación

> **Agregado el 2026-11-02:** el ciudadano también entra con su **cédula**: `POST /ciudadanos/acceso` decide entre pedir la contraseña o registrarse, y `POST /autenticacion/iniciar-sesion-ciudadano` inicia la sesión. Detalle en [`ACCESO_CEDULA_CIUDADANO_FLUTTER.md`](ACCESO_CEDULA_CIUDADANO_FLUTTER.md). El login con correo de abajo sigue funcionando.

Se reutiliza el login actual. No hay endpoints de sesión nuevos.

### Iniciar sesión: `POST /autenticacion/iniciar-sesion`

```json
{ "correo": "carlos.ciudadano@prueba.co", "contrasena": "Prueba123*segura" }
```

`200`:

```json
{
  "tokenAcceso": "<jwt>",
  "tipoToken": "Bearer",
  "expiraEn": "2026-11-03T11:14:39.036Z",
  "usuario": {
    "id": "6306702a-fa50-48e1-9370-9dd248140697",
    "nombres": "Carlos",
    "apellidos": "Pérez Díaz",
    "correo": "carlos.ciudadano@prueba.co",
    "rol": "ciudadano"
  }
}
```

- **Un ciudadano pendiente sí puede iniciar sesión:** la verificación no bloquea el login, solo los reportes.
- Credenciales malas o cuenta bloqueada → `401`, con el mismo mensaje en ambos casos.
- Límite: 5 intentos por minuto → `429`.
- **No hay token de renovación.** El token dura lo que diga `expiraEn` (hoy 8 horas). Al vencer, la API responde `401` y la app vuelve al login.
- Al abrir la app con sesión guardada: `GET /ciudadanos/perfil`. Con `200` entra; con `401` va al login.
- Cerrar sesión: `POST /autenticacion/cerrar-sesion`, como ya existe.
- Para decidir el inicio use `usuario.rol`. Con `ciudadano` vaya al flujo de la sección J.

---

## B. Registro: `POST /ciudadanos/registro`

Público (sin token), `multipart/form-data`.

### Campos de texto

| Campo | Obligatorio | Validación |
| --- | --- | --- |
| `nombres` | Sí | Texto, máx. 100 |
| `apellidos` | Sí | Texto, máx. 100 |
| `tipoDocumento` | Sí | `CC`, `CE`, `PPT`, `PEP` o `PA` (solo adultos) |
| `numeroDocumento` | Sí | Máx. 40. El backend quita puntos, guiones y espacios: quedan de 4 a 20 letras o números |
| `fechaNacimiento` | Sí | `AAAA-MM-DD`, fecha real; **mayor de 18 años** (día de Colombia) |
| `telefono` | Sí | 7–20 caracteres: dígitos, espacios, `-` y `+` inicial |
| `correo` | Sí | Correo válido, máx. 150 |
| `contrasena` | Sí | 10–128 caracteres, al menos una letra y un número |

**No envíe ningún otro campo** (`rol`, `estado`, etc.): cualquier campo de más responde `400`. El rol lo asigna el backend.

### Archivos

| Campo | Obligatorio | Regla |
| --- | --- | --- |
| `documentoFrontal` | Sí | Una foto JPG o PNG, de 5 KB a 5 MB |
| `documentoPosterior` | Sí | Igual |

- El backend comprueba que coincidan el tipo MIME, la extensión (`.jpg`, `.jpeg` o `.png`) y el contenido real. Envíe el `contentType` correcto (`image/jpeg` o `image/png`) y un nombre con su extensión.
- Más de 5 MB → `413`. Comprima en el celular antes de subir (por ejemplo, calidad 80 y lado mayor de 1600 px); se ve bien y pesa mucho menos.
- No envíe otros archivos ni otros nombres de campo: responde `400`.

### Ejemplo con Dio

```dart
final formulario = FormData.fromMap({
  'nombres': 'Carlos',
  'apellidos': 'Pérez Díaz',
  'tipoDocumento': 'CC',
  'numeroDocumento': '88.222.333',
  'fechaNacimiento': '1985-03-09',
  'telefono': '+57 310 555 1234',
  'correo': 'carlos.ciudadano@prueba.co',
  'contrasena': 'Prueba123*segura',
  'documentoFrontal': await MultipartFile.fromFile(rutaFrente,
      filename: 'frente.jpg', contentType: DioMediaType('image', 'jpeg')),
  'documentoPosterior': await MultipartFile.fromFile(rutaReverso,
      filename: 'reverso.jpg', contentType: DioMediaType('image', 'jpeg')),
});
final respuesta = await dio.post('/ciudadanos/registro', data: formulario);
```

### Respuesta `201`

El perfil, con la misma forma de `GET /ciudadanos/perfil`:

```json
{
  "id": "6306702a-fa50-48e1-9370-9dd248140697",
  "rol": "ciudadano",
  "nombres": "Carlos",
  "apellidos": "Pérez Díaz",
  "tipoDocumento": "CC",
  "numeroDocumento": "••••2333",
  "fechaNacimiento": "1985-03-09",
  "correo": "carlos.ciudadano@prueba.co",
  "telefono": "+57 310 555 1234",
  "creadoEn": "2026-11-03T03:14:38.749Z",
  "verificacion": {
    "estado": "pendiente",
    "motivo": null,
    "puedeReportarEmergencias": false,
    "puedeReenviar": false,
    "enviadaEn": "2026-11-03T03:14:38.749Z",
    "revisadaEn": null,
    "documentos": [
      { "lado": "posterior", "cargadoEn": "2026-11-03T03:14:38.749Z" },
      { "lado": "frontal", "cargadoEn": "2026-11-03T03:14:38.749Z" }
    ]
  }
}
```

El registro **no inicia sesión**. Después llame a `POST /autenticacion/iniciar-sesion` con el mismo correo y contraseña. `numeroDocumento` siempre llega enmascarado: solo los últimos 4 caracteres.

### Errores

| Código | Cuándo | Qué hacer |
| --- | --- | --- |
| `400` | Falta un campo o una foto, formato inválido, campo de más, archivo con otro nombre de campo | Mostrar los mensajes de `mensaje` (arreglo) junto a los campos |
| `409` | "Ya existe una cuenta con ese correo o ese número de documento" | Ofrecer iniciar sesión o recuperar acceso; no dice cuál de los dos, a propósito |
| `413` | Una foto supera 5 MB | Comprimir y reintentar |
| `422` | Menor de edad, fecha imposible, documento con caracteres inválidos, foto que no es JPG o PNG real o demasiado pequeña | Mostrar `mensaje` |
| `429` | Más de 5 registros en 15 minutos desde la misma red | Esperar |

---

## C. Verificación de identidad

Revisa un **administrador**; no hay aprobación automática ni biometría. Aprobar es una revisión documental interna, no una certificación oficial de identidad.

### Estados

| `estado` | Significado | `puedeReportarEmergencias` | `puedeReenviar` |
| --- | --- | --- | --- |
| `pendiente` | Enviada, en la fila | `false` | `false` |
| `en_revision` | Un administrador la está revisando | `false` | `false` |
| `verificado` | Aprobada | **`true`** | `false` |
| `requiere_correccion` | Hay que corregir algo; el motivo viene en `motivo` | `false` | **`true`** |
| `rechazado` | Rechazada (final en esta versión); el motivo viene en `motivo` | `false` | `false` |

**Para habilitar o bloquear acciones use los booleanos `puedeReportarEmergencias` y `puedeReenviar`**, no su propia lógica. El backend valida lo mismo en cada solicitud.

### Pantallas por estado

| Estado | Qué mostrar | Acciones |
| --- | --- | --- |
| `pendiente` / `en_revision` | "Estamos revisando su documento" + fecha de `enviadaEn` + aviso de la línea 123 | Mapa, perfil, mis reportes (vacío). **Sin botón de reportar** |
| `verificado` | Inicio normal | Reportar, mapa, mis reportes, perfil |
| `requiere_correccion` | "Necesitamos que corrija algo" + **`motivo`, tal cual** + botón "Corregir" | Pantalla de corrección (abajo) |
| `rechazado` | "No pudimos verificar su identidad" + `motivo` + "Para emergencias llame al 123" | Perfil y cerrar sesión |

- `motivo` está escrito para el ciudadano: muéstrelo completo. Las notas internas del administrador nunca llegan a la app.
- Para saber si cambió el estado: `GET /ciudadanos/perfil` al abrir la app, al volver a primer plano y al deslizar hacia abajo. No hay tiempo real para el ciudadano (sección H).

### Perfil: `GET /ciudadanos/perfil`

Rol `ciudadano`. Mismo cuerpo que la respuesta del registro. Ejemplo en `requiere_correccion`:

```json
{
  "id": "6306702a-fa50-48e1-9370-9dd248140697",
  "rol": "ciudadano",
  "nombres": "Carlos",
  "apellidos": "Pérez Díaz",
  "tipoDocumento": "CC",
  "numeroDocumento": "••••2333",
  "fechaNacimiento": "1985-03-09",
  "correo": "carlos.ciudadano@prueba.co",
  "telefono": "+57 310 555 1234",
  "creadoEn": "2026-11-03T03:14:38.749Z",
  "verificacion": {
    "estado": "requiere_correccion",
    "motivo": "La foto frontal está cortada; tómela completa",
    "puedeReportarEmergencias": false,
    "puedeReenviar": true,
    "enviadaEn": "2026-11-03T03:14:38.749Z",
    "revisadaEn": "2026-11-03T03:14:39.200Z",
    "documentos": [
      { "lado": "posterior", "cargadoEn": "2026-11-03T03:14:38.749Z" },
      { "lado": "frontal", "cargadoEn": "2026-11-03T03:14:38.749Z" }
    ]
  }
}
```

### Corrección: `PUT /ciudadanos/verificacion`

Rol `ciudadano`, `multipart/form-data`. **Solo funciona con `puedeReenviar: true`.**

Todo es opcional, pero debe enviar al menos una cosa:

| Parte | Tipo | Regla |
| --- | --- | --- |
| `documentoFrontal` | Archivo | Reemplaza la foto frontal (mismas reglas del registro) |
| `documentoPosterior` | Archivo | Reemplaza la posterior |
| `nombres`, `apellidos`, `tipoDocumento`, `numeroDocumento`, `fechaNacimiento` | Texto | Datos de identidad corregidos, con las mismas reglas del registro |

- Envíe solo lo que el `motivo` pide corregir. Lo que no envíe se conserva.
- Responde `200` con el perfil, que vuelve a `estado: "pendiente"`.

| Código | Cuándo |
| --- | --- |
| `400` | Campo inválido o de más |
| `409` | El número de documento ya está en otra cuenta, o la verificación cambió mientras tanto (recargue el perfil) |
| `413` | Foto de más de 5 MB |
| `422` | No está en `requiere_correccion`, no envió nada o la foto es inválida |

### Datos de contacto: `PATCH /ciudadanos/perfil`

```json
{ "telefono": "3109998877" }
```

- Campos: `correo` (máx. 150) y `telefono`, los dos opcionales. Responde `200` con el perfil.
- Correo de otra cuenta → `409`. Cualquier otro campo (`rol`, `estado`, documento…) → `400`.
- El documento y los nombres **no** se cambian aquí: solo en una corrección.

---

## E. Mapa y GPS

El mapa y sus mosaicos son responsabilidad de la app, como en la vista del conductor. La app pide los permisos y obtiene las coordenadas. El backend solo ofrece convertir un punto en dirección.

### Dirección de un punto: `POST /geocodificacion/inversa`

Ya existía; ahora también lo usa el rol `ciudadano`. Límite: 60 por minuto.

```json
{ "latitud": 7.893906, "longitud": -72.507782 }
```

`200`:

```json
{
  "id": "uuid",
  "puntoSolicitado": { "latitud": 7.893906, "longitud": -72.507782 },
  "direccion": "Av. 0 # 10-20, Cúcuta, Norte de Santander, Colombia",
  "lineaDireccion": "Av. 0 # 10-20",
  "componentes": {
    "calle": "Av. 0",
    "numero": "10-20",
    "barrio": null,
    "ciudad": "Cúcuta",
    "departamento": "Norte de Santander",
    "codigoPostal": null,
    "pais": "co"
  },
  "precision": "exacta",
  "distanciaMetros": 12.4,
  "coordenadasDireccion": { "latitud": 7.89392, "longitud": -72.5079 },
  "proveedor": "geoapify",
  "origen": "almacenada",
  "geocodificadaEn": "2026-11-03T03:10:00.000Z"
}
```

- `precision`: `exacta` (placa a 25 m o menos), `aproximada` (calle cercana) o `zona` (solo barrio o municipio). Con `zona` muestre "Ubicación aproximada" y pida una referencia.
- Muestre `lineaDireccion` si viene; si no, `direccion`.
- `422`: no hay dirección para ese punto. **No es un error para el ciudadano**: diga "No encontramos la dirección; describa el lugar en la referencia" y deje reportar igual.
- `503`: el proveedor no responde. Mismo manejo que el `422`.
- `429`: espere un momento antes de volver a consultar. No llame en cada movimiento del mapa: hágalo cuando el usuario suelte el marcador.
- Esta consulta es **solo para mostrar**. Al reportar, el backend vuelve a resolver la dirección por su cuenta.

### GPS frente a ubicación manual

| Caso | Qué hacer | `origenUbicacion` |
| --- | --- | --- |
| Hay permiso y señal | Use la posición del celular (centre el mapa ahí) | `"gps"` |
| El usuario mueve el marcador | Use el punto marcado | `"manual"` |
| Sin permiso, GPS apagado o sin señal | Mapa centrado en la ciudad; el usuario marca el punto | `"manual"` |

- **No asuma que siempre hay GPS:** el reporte debe poder hacerse marcando el punto a mano.
- Coordenadas: números decimales, **máximo 7 decimales**. Redondee antes de enviar: con más decimales responde `400`. Latitud entre −90 y 90, longitud entre −180 y 180. No envíe `0,0` como "sin ubicación": si no hay punto, no deje enviar.

---

## F. Reportar emergencia: `POST /ciudadanos/emergencias`

Rol `ciudadano` con `puedeReportarEmergencias: true`. Límite: 5 por minuto.

### Campos

| Campo | Obligatorio | Validación |
| --- | --- | --- |
| `id` | Sí | UUID generado por la app (ver Idempotencia) |
| `tipoIncidente` | Sí | Uno de la tabla de abajo |
| `descripcion` | Sí | 10–1000 caracteres |
| `numeroVictimas` | No | Entero de 1 a 100 |
| `latitud`, `longitud` | Sí | Rangos válidos, máx. 7 decimales |
| `origenUbicacion` | Sí | `gps` o `manual` |
| `referenciaLugar` | No | Máx. 255 (ej.: "Frente a la panadería") |

**No existen ni se aceptan** `prioridad`, `estado`, `direccion`, `informanteNombre`, `informanteTelefono`, `informanteUsuarioId` ni nada de ambulancias: responden `400`.

- El informante sale de la cuenta (nombre y teléfono del perfil).
- La dirección la resuelve el servidor.
- La prioridad la define el operador.

### Tipos de incidente

Es el catálogo del sistema; no hay otros.

| Valor | Texto sugerido |
| --- | --- |
| `accidente_transito` | Accidente de tránsito |
| `clinico` | Emergencia médica (desmayo, dolor en el pecho, convulsión, parto…) |
| `caida` | Persona lesionada por caída |
| `quemadura` | Quemaduras |
| `arma` | Herida por arma |
| `otro` | Otro incidente |

### Ejemplo

```json
{
  "id": "2f1c3c1e-8a0e-4c7b-9d0a-7b8f6f1e2a10",
  "tipoIncidente": "accidente_transito",
  "descripcion": "Choque de moto contra carro, el motociclista no se levanta",
  "numeroVictimas": 2,
  "latitud": 7.893906,
  "longitud": -72.507782,
  "origenUbicacion": "gps",
  "referenciaLugar": "Frente a la panadería"
}
```

### Respuesta

`201` si es nuevo; `200` si es un reintento del mismo `id`.

```json
{
  "id": "2f1c3c1e-8a0e-4c7b-9d0a-7b8f6f1e2a10",
  "numeroEmergencia": "EMG-20261102-0016",
  "tipoIncidente": "accidente_transito",
  "descripcion": "Choque de moto contra carro, el motociclista no se levanta",
  "direccion": "Av. 0 # 10-20, Cúcuta, Norte de Santander, Colombia",
  "referenciaLugar": "Frente a la panadería",
  "coordenadas": { "latitud": 7.893906, "longitud": -72.507782 },
  "origenUbicacion": "gps",
  "numeroVictimas": 2,
  "estado": "recibida",
  "unidoAOtroReporte": false,
  "recibidaEn": "2026-11-03T03:14:03.968Z",
  "cerradaEn": null,
  "creado": true
}
```

`direccion` puede llegar en `null` si el servidor no encontró la dirección. El reporte igual queda registrado: la central tiene las coordenadas y la referencia.

### Idempotencia: evite reportes duplicados por mala señal

1. Al tocar "Enviar", genere un UUID v4 (paquete `uuid`) y **guárdelo con el borrador**.
2. Envíe el reporte con ese `id`.
3. Si se corta la conexión o hay timeout, **reintente con el mismo `id`**: si el primero llegó, la API responde `200` con el mismo reporte y `creado: false`, sin crear otro.
4. Solo genere un `id` nuevo para un reporte realmente distinto.
5. `409` "Ese identificador de reporte ya está en uso" solo pasa si se reutilizó un id ajeno: genere uno nuevo.

### Errores

| Código | Cuándo | Qué hacer |
| --- | --- | --- |
| `400` | Validación (arreglo en `mensaje`) o campo prohibido | Corregir el formulario |
| `401` | Sesión vencida | Login; conservar el borrador y el `id` |
| `403` | **Identidad no verificada** (mensaje con la línea 123), o el usuario no es ciudadano | Mostrar el mensaje y llevar a la pantalla de verificación |
| `409` | `id` ajeno | Nuevo UUID y reintentar |
| `429` | Más de 5 por minuto | Esperar; no crear otro `id` |
| `500` / sin respuesta | — | Reintentar con el mismo `id`, con espera creciente |

### Después de enviar

- Muestre: "Reporte recibido. Número **EMG-20261102-0016**. La central lo está revisando. Si la situación empeora, llame al 123."
- **No muestre "ambulancia en camino"**: `recibida` significa que la central aún no despacha.
- Borre el borrador local solo después de un `200` o `201`.

---

## G. Mis reportes

### Lista: `GET /ciudadanos/emergencias`

Rol `ciudadano`. Solo trae los reportes del propio ciudadano, del más reciente al más antiguo.

| Parámetro | Tipo | Detalle |
| --- | --- | --- |
| `pagina`, `limite` | Entero | Por defecto 1 y 20; `limite` máx. 100 |
| `estado` | Texto | `recibida`, `despachada`, `en_atencion`, `cerrada` o `cancelada` |
| `desde`, `hasta` | ISO 8601 | Por fecha de recepción |

```json
{
  "datos": [
    {
      "id": "2f1c3c1e-8a0e-4c7b-9d0a-7b8f6f1e2a10",
      "numeroEmergencia": "EMG-20261102-0016",
      "tipoIncidente": "accidente_transito",
      "descripcion": "Choque de moto contra carro, el motociclista no se levanta",
      "direccion": "Av. 0 # 10-20, Cúcuta, Norte de Santander, Colombia",
      "referenciaLugar": "Frente a la panadería",
      "coordenadas": { "latitud": 7.893906, "longitud": -72.507782 },
      "origenUbicacion": "gps",
      "numeroVictimas": 2,
      "estado": "recibida",
      "unidoAOtroReporte": false,
      "recibidaEn": "2026-11-03T03:14:03.968Z",
      "cerradaEn": null
    }
  ],
  "total": 1,
  "pagina": 1,
  "limite": 20
}
```

### Detalle: `GET /ciudadanos/emergencias/{id}`

Mismo objeto que cada elemento de la lista. Un reporte ajeno o inexistente responde `404` "Reporte no encontrado"; la API no distingue los dos casos, a propósito.

### Estados para mostrar

| `estado` | Texto sugerido |
| --- | --- |
| `recibida` | Recibido: la central lo está revisando |
| `despachada` | La central envió una ambulancia |
| `en_atencion` | La ambulancia está atendiendo el incidente |
| `cerrada` | Atención finalizada |
| `cancelada` + `unidoAOtroReporte: true` | Otra persona ya había reportado este incidente; se atiende allí |
| `cancelada` + `unidoAOtroReporte: false` | La central cerró el reporte |

La respuesta no trae prioridad, nombres del personal ni datos de otros reportes.

---

## H. WebSocket

**El ciudadano no usa WebSocket en esta versión.** El servidor de tiempo real valida el rol contra su propia lista, que no incluye `ciudadano`. Según su código, rechaza la conexión con un token de ciudadano; no se probó con una conexión real. **No intente conectarse con el rol ciudadano.**

En su lugar, consulte por REST:

| Dato | Cuándo consultarlo |
| --- | --- |
| Estado de verificación (`GET /ciudadanos/perfil`) | Al abrir la app, al volver a primer plano y al deslizar hacia abajo en la pantalla de verificación |
| Estado de un reporte (`GET /ciudadanos/emergencias/{id}`) | Con el detalle abierto, cada 30 s; detenga la consulta en `cerrada` o `cancelada` |

**Para la central sí hay tiempo real:** al reportar, el backend guarda la emergencia y después publica `emergencia.creada` a la sala `central`. El evento lleva el reporte y los datos del informante, pero nunca documentos, fotos ni contraseñas. Si el tiempo real falla, el reporte no se pierde: queda en la base de datos y la central lo ve en su lista. La app no tiene que hacer nada con esto.

---

## I. Manejo de errores

Todas las respuestas de error tienen esta forma:

```json
{
  "codigoEstado": 403,
  "error": "FORBIDDEN",
  "mensaje": "Su identidad todavía no ha sido verificada; no puede reportar emergencias desde la app. Si la emergencia es inmediata, llame a la línea 123.",
  "ruta": "/api/v1/ciudadanos/emergencias",
  "fecha": "2026-11-03T03:14:39.065Z"
}
```

`mensaje` es texto, o un **arreglo de textos** en los `400` de validación:

```json
{
  "codigoEstado": 400,
  "error": "BAD_REQUEST",
  "mensaje": [
    "property prioridad should not exist",
    "id must be a UUID",
    "tipoIncidente must be one of the following values: accidente_transito, caida, arma, quemadura, clinico, otro",
    "descripcion must be longer than or equal to 10 characters",
    "latitud must not be greater than 90"
  ],
  "ruta": "/api/v1/ciudadanos/emergencias",
  "fecha": "2026-11-03T03:14:39.285Z"
}
```

Los mensajes de validación (`400`) vienen en inglés, porque los genera la librería. Valide el formulario en la app con las reglas de esta guía para que el usuario casi nunca los vea. Los demás mensajes (`403`, `409`, `422`) vienen en español: muéstrelos tal cual.

| Código | Qué hacer en la app |
| --- | --- |
| `400` | Error del formulario: marque los campos. Si llega con datos que la app validó, es un error de programación |
| `401` | Sesión inválida o vencida: borre el token y vaya al login, conservando los borradores |
| `403` | En reportes: "identidad no verificada", lleve a verificación. En otros: el rol no corresponde; cierre la sesión |
| `404` | El recurso no existe o no es suyo: vuelva a la lista |
| `409` | Conflicto: correo o documento ya registrado, `id` de reporte ajeno, verificación cambiada. Muestre el mensaje y recargue |
| `413` | Foto demasiado grande: comprima y reintente |
| `422` | Regla de negocio: muestre `mensaje` |
| `429` | Demasiadas solicitudes: espere y reintente sin duplicar |
| `500`, `503`, sin red | Mensaje genérico. En reportes, reintente con el mismo `id` y siempre muestre la opción de llamar al 123 |

---

## J. Flujos de navegación

1. **Registro:** bienvenida → "Crear cuenta" → formulario → fotos frontal y posterior (cámara, con vista previa y comprimidas) → aceptar los términos → `POST /ciudadanos/registro` → `201` → login automático con el correo y la contraseña recién escritos → pantalla de verificación pendiente.
2. **Inicio de sesión:** login → si `usuario.rol == 'ciudadano'`, `GET /ciudadanos/perfil` → según `verificacion.estado` (flujos 3, 4 o 5).
3. **Verificación pendiente** (`pendiente` o `en_revision`): "Estamos revisando su documento", mapa en solo lectura, mis reportes, perfil y aviso del 123. Recargue el perfil al volver a primer plano.
4. **Verificación aprobada** (`verificado`): inicio con el mapa y el botón "Reportar emergencia".
5. **Verificación rechazada** (`rechazado`): mensaje con `motivo`, opción de llamar al 123 y cerrar sesión. Sin reportes.
6. **Corrección de documentos** (`requiere_correccion`): `motivo` → "Corregir" → formulario con las fotos y los campos que haya que cambiar → `PUT /ciudadanos/verificacion` → `200` con `pendiente` → flujo 3.
7. **Consulta del mapa:** permiso de ubicación → si se concede, centrar en el GPS; si no, en la ciudad → al soltar el marcador, `POST /geocodificacion/inversa` para mostrar la dirección.
8. **Creación de emergencia** (solo `verificado`):
   - mapa con el punto (GPS o manual) → formulario (tipo, descripción, víctimas, referencia) → confirmar;
   - generar el `id` y guardar el borrador → `POST /ciudadanos/emergencias`;
   - con `201` o `200`: pantalla de "Reporte recibido" con el número;
   - con un fallo de red: reintentar con el mismo `id`.
9. **Consulta de reportes:** "Mis reportes" → lista paginada (deslizar para cargar más) → detalle con el estado, que se recarga cada 30 s mientras esté abierto.
10. **Sesión expirada:** cualquier `401` → borrar el token → login → volver a la pantalla donde estaba, con el borrador y el `id` intactos.

---

## K. Resumen de endpoints

| Método | Ruta | Token | Rol | Uso |
| --- | --- | --- | --- | --- |
| POST | `/ciudadanos/registro` | No | — | Crear la cuenta (multipart) |
| POST | `/ciudadanos/acceso` | No | — | ¿La cédula tiene cuenta? (`ACCESO_CEDULA_CIUDADANO_FLUTTER.md`) |
| POST | `/autenticacion/iniciar-sesion-ciudadano` | No | — | Login con cédula y contraseña |
| POST | `/autenticacion/iniciar-sesion` | No | — | Login con correo (existente) |
| POST | `/autenticacion/cerrar-sesion` | Sí | Cualquiera | Cerrar sesión (existente) |
| GET | `/ciudadanos/perfil` | Sí | ciudadano | Perfil y verificación |
| PATCH | `/ciudadanos/perfil` | Sí | ciudadano | Correo y teléfono |
| PUT | `/ciudadanos/verificacion` | Sí | ciudadano | Corrección (multipart) |
| POST | `/geocodificacion/inversa` | Sí | ciudadano | Dirección de un punto (existente) |
| POST | `/ciudadanos/emergencias` | Sí | ciudadano verificado | Reportar |
| GET | `/ciudadanos/emergencias` | Sí | ciudadano | Mis reportes |
| GET | `/ciudadanos/emergencias/{id}` | Sí | ciudadano | Detalle de un reporte |

Los endpoints de revisión (`/verificaciones-ciudadanos/...`) son del administrador en la web; la app no los usa.

---

## Datos personales

- Antes del registro, muestre la **política de tratamiento de datos personales** (Ley 1581 de 2012) y pida aceptarla. **Pendiente en el backend:** la API todavía no registra esa aceptación; su texto y su registro están por definir con asesoría jurídica. No invente un campo para eso: avise si lo necesita y se agregará.
- No guarde copias de las fotos del documento después de un `201` o `200`: bórrelas de la caché de la app.
- No escriba en los logs de la app el token, la contraseña, el número de documento ni las fotos.
