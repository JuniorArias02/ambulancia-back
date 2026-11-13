# Inventario: guía para el frontend web

## 1. Alcance de la web

Los roles **`administrador`** y **`despachador`** tienen los mismos permisos en todo el módulo. Los demás roles reciben `403`.

La web administra:

- Catálogo de **insumos** y sus **registros sanitarios**.
- **Bodegas** y **ubicaciones** de inventario (bodegas y ambulancias).
- **Lotes** y **equipos** (con su historial de **mantenimientos**).
- **Movimientos**: entradas, transferencias, ajustes y bajas. También **recibe las devoluciones** de los paramédicos.
- **Perfiles de dotación** por tipo de ambulancia, con versiones.
- **Existencias**, **dotación de cada ambulancia**, **alertas**, **controles de temperatura y humedad** y **verificaciones** hechas por los paramédicos.

El inventario **dentro de la ambulancia** (consumos, conteos) lo opera el paramédico desde la app. La web lo consulta.

Prefijo `/api/v1`, con `Authorization: Bearer <tokenAcceso>`. Los listados aceptan `pagina` (desde 1) y `limite` (1 a 100, por defecto 20) y responden `{ datos, total, pagina, limite }`. Las fechas de calendario son `AAAA-MM-DD`; las fechas con hora son ISO 8601.

---

## 2. Orden de configuración (primer uso)

1. **Insumos** del catálogo.
2. **Registros sanitarios** de los insumos que los exigen.
3. **Bodegas.** Cada una crea su ubicación de inventario automáticamente.
4. **Lotes** (medicamentos) y **equipos** (por serie).
5. **Entrada** de existencias a la bodega.
6. **Perfil de dotación** por tipo de ambulancia, y activarlo.
7. **Transferencia** de la bodega a cada ambulancia (abastecer).

---

## 3. Insumos: `/inventario/insumos`

| Método | Ruta | Para qué |
| --- | --- | --- |
| POST | `/inventario/insumos` | Crear |
| GET | `/inventario/insumos?busqueda=&tipo=&activo=&esControlEspecial=` | Listar |
| GET | `/inventario/insumos/{id}` | Detalle |
| PATCH | `/inventario/insumos/{id}` | Editar (lo que no se envía no cambia) |
| PATCH | `/inventario/insumos/{id}/estado` | `{ "activo": false }` desactiva. Nada se borra |

Crear:

```json
{
  "codigo": "MED-0001",
  "nombre": "Adrenalina 1 mg/ml",
  "tipo": "medicamento",
  "categoria": "Vasopresores",
  "unidadMedida": "ampolla",
  "requiereLote": true,
  "requiereVencimiento": true,
  "requiereRegistroSanitario": true,
  "requiereSerie": false,
  "esControlEspecial": false,
  "stockMinimo": 50
}
```

- `tipo`: `medicamento`, `dispositivo_medico`, `insumo_asistencial`, `equipo_biomedico`, `oxigeno_medicinal` u `otro`.
- `codigo` se guarda en mayúscula y debe ser único (`409` si se repite).
- **Banderas de control**, con validación en el formulario:
  - `requiereSerie` y `requiereLote` no pueden estar ambas activas (`422`).
  - `requiereVencimiento` exige `requiereLote` (el vencimiento vive en el lote).
  - **Por defecto, `requiereLote` es `true`.** Para gasas, guantes y otros elementos sin lote, envíe `false`.
- La respuesta incluye `control` (`serie`, `lote` o `insumo`), que dice qué pedir al moverlo: `equipoId`, `loteId` o nada.
- `stockMinimo` se compara con lo que hay **en las bodegas activas**. Si queda por debajo, el insumo sale en las alertas.
- Si el insumo ya tiene existencias o movimientos, **no se pueden cambiar `requiereLote` ni `requiereSerie`** (`409`). Ocúltelas o bloquéelas en la edición.

---

## 4. Registros sanitarios: `/inventario/registros-sanitarios`

| Método | Ruta |
| --- | --- |
| POST | `/inventario/registros-sanitarios` |
| GET | `/inventario/registros-sanitarios?insumoId=&estado=&vencenHasta=` |
| GET / PATCH | `/inventario/registros-sanitarios/{id}` |

```json
{
  "insumoId": "uuid",
  "numeroRegistro": "INVIMA 2020M-0012345",
  "tipoRegistro": "registro_sanitario",
  "fechaExpedicion": "2020-01-15",
  "fechaVencimiento": "2030-01-15",
  "titular": "Laboratorio X",
  "documentoUrl": "https://…/soporte.pdf",
  "estado": "vigente"
}
```

- `tipoRegistro`: `registro_sanitario`, `permiso_comercializacion`, `notificacion_sanitaria` u `otro`.
- `estado`: `vigente`, `vencido`, `suspendido` o `cancelado`. Se cambia con `PATCH`.
- `documentoUrl` debe ser `http(s)`.
- La respuesta trae `vigenteHoy`: es `true` si está en estado `vigente` y no ha vencido.
- Si el insumo exige registro, sus lotes y equipos **deben** llevar uno vigente y del mismo insumo (`422`).

---

## 5. Bodegas y ubicaciones

| Método | Ruta | Para qué |
| --- | --- | --- |
| POST | `/inventario/bodegas` | `{ codigo, nombre, ubicacion?, responsableId? }` |
| GET | `/inventario/bodegas?busqueda=&activa=` | Listar |
| GET / PATCH | `/inventario/bodegas/{id}` | Detalle o edición |
| PATCH | `/inventario/bodegas/{id}/estado` | `{ "activo": false }` |
| GET | `/inventario/ubicaciones?tipo=&activa=` | Todas las ubicaciones, para los selectores de origen y destino |
| POST | `/inventario/ubicaciones/ambulancias` | `{ ambulanciaId }`: habilita una ambulancia (201 si la crea, 200 si ya existía) |
| PATCH | `/inventario/ubicaciones/{id}/estado` | `{ "activa": false }`: solo para ambulancias |

- Cada bodega trae `ubicacionInventarioId`: **ese** es el id que se usa como origen o destino de los movimientos.
- `responsableId` debe ser personal interno activo, nunca un ciudadano (`422`).
- Desactivar una bodega bloquea su ubicación: no recibe ni entrega movimientos.
- Una ambulancia también se habilita sola la primera vez que su paramédico abre el inventario.

`UbicacionInventarioRespuestaDto`: `{ id, tipo: "bodega"|"ambulancia", nombre, bodegaId, ambulanciaId, activa }`. Para una ambulancia, `nombre` es su código.

---

## 6. Lotes y equipos

### Lotes: `/inventario/lotes`

```json
{
  "insumoId": "uuid",
  "registroSanitarioId": "uuid",
  "numeroLote": "L2026-0457",
  "fechaFabricacion": "2026-01-10",
  "fechaVencimiento": "2027-01-10",
  "fabricante": "…",
  "proveedor": "…",
  "recibidoEn": "2026-11-11T14:00:00Z",
  "documentoSoporte": "FV-1234"
}
```

- Solo para insumos con `control: "lote"`. Si el insumo exige vencimiento, `fechaVencimiento` es obligatoria.
- `(insumo, numeroLote)` es único (`409`).
- `PATCH` corrige fechas, fabricante, proveedor, documento y observaciones. **Los cambios de vencimiento quedan auditados.**
- La respuesta trae `vencido` (calculado con el día de Colombia).
- **Crear un lote no suma existencias**: eso lo hace una **entrada**.

### Equipos: `/inventario/equipos`

| Método | Ruta |
| --- | --- |
| POST | `/inventario/equipos` → `{ insumoId, registroSanitarioId?, numeroSerie, marca?, modelo?, fechaAdquisicion?, fechaProximoMantenimiento? }` |
| GET | `/inventario/equipos?insumoId=&estado=&busqueda=&mantenimientoHasta=` |
| GET / PATCH | `/inventario/equipos/{id}` |
| PATCH | `/inventario/equipos/{id}/estado` → `{ "estado": "mantenimiento", "motivo": "…" }` |
| POST | `/inventario/equipos/{id}/mantenimientos` |
| GET | `/inventario/equipos/{id}/mantenimientos` |

- Solo para insumos con `control: "serie"`. `numeroSerie` es único.
- `estado`: `operativo`, `mantenimiento`, `fuera_servicio` o `baja`. **La baja es definitiva**: luego no admite cambios.
- **Un equipo que no está operativo no puede ir a una ambulancia.** Si está en una, deja de contar en su dotación.

Registrar un mantenimiento:

```json
{
  "tipo": "preventivo",
  "fechaMantenimiento": "2026-11-01",
  "fechaProximo": "2027-05-01",
  "responsable": "Ing. Pérez",
  "proveedor": "BioServicios",
  "resultado": "aprobado"
}
```

- `tipo`: `preventivo`, `correctivo` o `calibracion`.
- La fecha del mantenimiento no puede ser futura, y la próxima debe ser posterior a ella.
- Si es el más reciente, actualiza en el equipo `fechaUltimoMantenimiento` y `fechaProximoMantenimiento`. La respuesta trae `{ equipo, mantenimiento }`.

---

## 7. Movimientos: `/inventario/movimientos`

| Método | Ruta | Para qué |
| --- | --- | --- |
| POST | `/inventario/movimientos` | Registrar (en borrador, o confirmado con `confirmar: true`) |
| GET | `/inventario/movimientos?tipo=&estado=&ubicacionId=&insumoId=&asignacionId=&usuarioId=&desde=&hasta=` | Listar, del más reciente al más antiguo |
| GET | `/inventario/movimientos/{id}` | Detalle |
| POST | `/inventario/movimientos/{id}/confirmar` | Aplica las existencias |
| POST | `/inventario/movimientos/{id}/anular` | `{ "motivo": "…" }` (obligatorio) |

### 7.1 Tipos y ubicaciones

| `tipo` | Origen | Destino | Notas |
| --- | --- | --- | --- |
| `entrada` | — | **bodega** | Compra o donación. Insumos activos |
| `transferencia` | sí | sí | Bodega → ambulancia (abastecer), bodega → bodega… |
| `consumo` | **ambulancia** | — | Normalmente lo registra el paramédico; puede llevar `asignacionId` |
| `devolucion` | **ambulancia** | **bodega** | La crea el paramédico en borrador; **la bodega la confirma** al recibirla |
| `ajuste` | solo uno | solo uno | Solo destino = **aumenta**; solo origen = **disminuye**. `motivo` obligatorio |
| `baja` | sí | — | Vencidos, dañados. `motivo` obligatorio |

Arme el formulario según el tipo: muestre u oculte los selectores de origen y destino con esta tabla.

### 7.2 Cuerpo

```json
{
  "tipo": "transferencia",
  "origenUbicacionId": "uuid-ubicacion-bodega",
  "destinoUbicacionId": "uuid-ubicacion-ambulancia",
  "motivo": null,
  "documentoReferencia": "Remisión 0045",
  "observaciones": null,
  "realizadoEn": "2026-11-11T13:00:00Z",
  "confirmar": false,
  "lineas": [
    { "insumoId": "uuid-gasa", "cantidad": 30 },
    { "insumoId": "uuid-adrenalina", "loteId": "uuid-lote", "cantidad": 10 },
    { "insumoId": "uuid-dea", "equipoId": "uuid-equipo", "cantidad": 1 }
  ]
}
```

- Cada línea lleva el identificador que pide el `control` del insumo: `loteId`, `equipoId` o ninguno. Si no corresponde, recibe `422`.
- Cantidades mayores que 0 con hasta 3 decimales. Los equipos se mueven de a 1.
- Entre 1 y 200 líneas, **sin repetir la misma unidad**.
- `realizadoEn` es opcional (por defecto, ahora) y no puede ser futuro.
- El backend genera el `codigo`, por ejemplo `MOV-20261111-1A2B3C4D`.

### 7.3 Estados

```
borrador ──confirmar──▶ confirmado   (cambia existencias; ya no se toca)
    └──────anular─────▶ anulado      (queda como constancia)
```

- **Un movimiento confirmado no se edita ni se anula: se corrige con un ajuste.**
- Al confirmar, el backend **revalida con la fecha del día**: un lote pudo vencer o un equipo dañarse desde que se creó el borrador.
- **Lotes vencidos:** no pueden ir a una ambulancia ni consumirse. Sí pueden darse de baja, devolverse o ajustarse.

### 7.4 Errores al registrar o confirmar

| Código | Cuándo |
| --- | --- |
| `409` | **Existencia insuficiente**. El mensaje dice cuánto hay: *"No alcanza Gasa estéril en Bodega central: hay 70 y se necesitan 1000"*. **No se aplica nada** (todo o nada). También: un equipo que ya está en otra ubicación, o un borrador que otra persona confirmó o anuló |
| `422` | Origen o destino no válidos para el tipo, ubicación inactiva, lote vencido hacia una ambulancia, equipo no operativo, falta el motivo, falta el lote o la serie, o el movimiento ya estaba confirmado o anulado |
| `404` | Ubicación, insumo, lote, equipo o servicio inexistente |

Las confirmaciones simultáneas son seguras: las existencias nunca quedan negativas.

### 7.5 Bandeja de devoluciones

Liste `GET /inventario/movimientos?tipo=devolucion&estado=borrador` como **"Devoluciones por recibir"**. Al recibir la mercancía, use **Confirmar**. Si no llegó o está mal, use **Anular** con un motivo.

---

## 8. Existencias, dotación y alertas

### `GET /inventario/existencias?ubicacionId=&tipoUbicacion=&insumoId=&tipoInsumo=&busqueda=&incluirAgotadas=`

Cada fila trae:

- ubicación: `ubicacionId`, `ubicacionTipo`, `ubicacionNombre`
- insumo: `insumoId`, `insumoCodigo`, `insumoNombre`, `unidadMedida`
- lote: `loteId`, `numeroLote`, `loteVencimiento`
- equipo: `equipoId`, `numeroSerie`, `equipoEstado`
- `claveControl`, `cantidad`, `utilizable`, `actualizadaEn`

`utilizable: false` indica un lote vencido o un equipo no operativo. Por defecto **no** aparecen las existencias en 0; para verlas, use `incluirAgotadas=true`.

### `GET /inventario/ambulancias/{ambulanciaId}/dotacion`

Compara lo que hay en la ambulancia (sin contar lo vencido ni los equipos fuera de operación) con el perfil vigente de su tipo:

```json
{
  "ambulanciaId": "uuid", "ambulanciaCodigo": "AMB-02", "fecha": "2026-11-11",
  "ubicacion": { "…": "…" },
  "perfil": { "id": "uuid", "codigo": "DOT-TAB", "nombre": "Dotación TAB", "version": 2 },
  "completa": false,
  "items": [
    { "insumoId": "uuid", "insumoNombre": "Gasa", "unidadMedida": "unidad", "cantidadRequerida": 25, "cantidadMinima": 20,
      "obligatorio": true, "disponible": 12, "noUtilizable": 0, "faltante": 13, "estado": "bajo_minimo" }
  ],
  "adicionales": [],
  "existencias": []
}
```

- `estado`: `completo` (verde), `incompleto` (amarillo, entre el mínimo y lo requerido) o `bajo_minimo` (rojo).
- `faltante` es **lo que hay que transferir** para completar. Sirve para armar el abastecimiento.
- `perfil: null` y `completa: null` significan que el tipo no tiene un perfil vigente.

### `GET /inventario/alertas?dias=30`

Tablero de la bodega. Busca hasta `dias` días hacia adelante (de 0 a 365) e incluye lo que ya venció:

- `lotesPorVencer`: lotes **con existencias**, con su ubicación y cantidad.
- `equiposPorMantenimiento`: equipos que no están de baja y cuyo próximo mantenimiento cae dentro del plazo.
- `registrosPorVencer`: registros sanitarios vigentes que vencen dentro del plazo.
- `insumosBajoMinimo`: insumos cuyo total en bodegas activas es menor que su `stockMinimo`.

Cada lista trae como máximo 100 elementos, los más urgentes primero.

---

## 9. Perfiles de dotación: `/inventario/perfiles-dotacion`

| Método | Ruta | Para qué |
| --- | --- | --- |
| POST | `/inventario/perfiles-dotacion` | Crear la **versión 1** de un código (nace **inactivo**) |
| GET | `/inventario/perfiles-dotacion?tipoAmbulanciaId=&activo=&codigo=` | Listar |
| GET / PATCH | `/inventario/perfiles-dotacion/{id}` | Detalle, o editar nombre, descripción y vigencia |
| PATCH | `/inventario/perfiles-dotacion/{id}/estado` | `{ "activo": true }` |
| POST | `/inventario/perfiles-dotacion/{id}/versiones` | Crear la versión siguiente (copia inactiva y sin vigencia) |
| POST | `/inventario/perfiles-dotacion/{id}/detalles` | Agregar un insumo |
| PATCH / DELETE | `/inventario/perfiles-dotacion/{id}/detalles/{detalleId}` | Editar o quitar un elemento |

```json
{
  "tipoAmbulanciaId": "uuid-TAB",
  "codigo": "DOT-TAB",
  "nombre": "Dotación básica TAB",
  "vigenteDesde": "2026-11-01",
  "vigenteHasta": null,
  "detalles": [
    { "insumoId": "uuid", "cantidadRequerida": 25, "cantidadMinima": 20, "obligatorio": true },
    { "insumoId": "uuid-dea", "cantidadRequerida": 1 }
  ]
}
```

- Los tipos de ambulancia salen de `GET /tipos-ambulancia`.
- **Solo un perfil activo por tipo.** Activar uno desactiva los demás de ese tipo.
- Para activar hace falta al menos un elemento y que su vigencia no haya terminado.
- Rige si está activo y la fecha de hoy está dentro de su vigencia (`vigenteHoy` en la respuesta).
- `cantidadMinima`: por debajo es crítico. Si es `null`, equivale a la requerida. No puede superar la requerida.
- Los equipos (por serie) piden cantidades enteras.
- Un código ya existente para el mismo tipo responde `409`: use **"Nueva versión"**.
- **Flujo recomendado para cambiar la dotación:** Nueva versión → ajustar elementos y vigencia → Activar. La versión anterior queda inactiva como historial.

---

## 10. Controles y verificaciones

### Temperatura y humedad

- `POST /inventario/controles-almacenamiento` → `{ ubicacionId, temperatura?, humedad?, registradoEn?, observaciones? }`. Al menos una lectura; temperatura de −50 a 100 °C y humedad de 0 a 100 %.
- `GET /inventario/controles-almacenamiento?ubicacionId=&desde=&hasta=` → historial con `usuarioNombre`. Sirve para graficar la cadena de frío.

### Verificaciones de los paramédicos

- `GET /inventario/verificaciones?ubicacionId=&responsableId=&estado=&tipo=&revisada=&desde=&hasta=`
- `GET /inventario/verificaciones/{id}`
- `POST /inventario/verificaciones/{id}/revision` → `{ "resolucion": "…" }` (**nuevo**, ver abajo)

Cada verificación trae `tipo` (`inicio_turno`, `fin_turno` o `extraordinaria`), `estado` (`borrador`, `completada` o `con_novedades`), `totalNovedades` y sus `conteos`. Cada conteo incluye `cantidadEsperada` (lo que decía el sistema), `cantidadEncontrada`, `estado` (`conforme`, `faltante`, `sobrante`, `vencido` o `danado`) y `observaciones`.

**La verificación no cambia existencias.** La bandeja **"Novedades por revisar"** (`revisada=false`) es desde donde la bodega decide qué hacer:

- **ajuste** para un faltante o un sobrante,
- **baja** para un vencido o un dañado,
- **transferencia** para reponer.

Después de corregir, la central **marca la verificación como revisada** y deja constancia de cómo lo resolvió, con lo que sale de la bandeja. Cada verificación trae `pendienteDeRevision` y `revision` (quién, cuándo y cómo). **Detalle completo en [`INVENTARIO_REVISION_NOVEDADES_FRONTEND.md`](INVENTARIO_REVISION_NOVEDADES_FRONTEND.md).**

---

## 11. Errores

El cuerpo de error es `{ "codigoEstado", "error", "mensaje", "ruta", "fecha" }`. Muestre `mensaje`, que está en español.

| Código | Significado |
| --- | --- |
| `400` | Validación del formulario: tipo, formato, campo no permitido, más de 3 decimales, fecha mal escrita |
| `401` / `403` | Sesión vencida / rol sin permiso |
| `404` | No existe |
| `409` | Duplicado (código, serie, lote, registro), existencia insuficiente, o alguien cambió el dato al mismo tiempo |
| `422` | Regla de negocio (ver cada sección) |

---

## 12. Lo que aún no existe

- **Tiempo real:** no hay eventos WebSocket del inventario. Refresque después de cada acción o con un intervalo en el tablero.
- **Archivos:** los soportes (`documentoUrl`, `documentoSoporte`) son texto o URL; el backend no los aloja.
- **Reportes o exportación** (Excel, PDF): no están implementados.

---

## Datos de prueba

En desarrollo, `npm run db:semilla` carga 80 insumos y los perfiles `DOT-TAB` y `DOT-TAM`, y `npm run db:semilla:inventario-demo` carga lo siguiente:

- la bodega `BOD-CENTRAL`;
- lotes y registros `DEMO-…`;
- equipos `DEMO-EQ-…`;
- todas las ambulancias abastecidas según su perfil.

Las alertas ya traen un lote vencido, uno por vencer, un mantenimiento próximo y un insumo bajo el mínimo.
