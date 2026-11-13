# Inventario de la ambulancia (paramédico)

## 1. Qué hace el paramédico desde la app

El paramédico gestiona **solo el inventario de la ambulancia que eligió** en la app (la de su turno activo):

1. **Ver** qué hay en la ambulancia y si cumple la dotación exigida para su tipo (TAB, TAM…).
2. **Registrar consumos**: lo que usó con un paciente. Se descuenta de inmediato.
3. **Devolver** sobrantes a una bodega. La devolución queda **pendiente** hasta que la bodega la recibe.
4. **Verificar** el inventario: contar lo que hay (al inicio o al fin del turno, o de forma extraordinaria) y reportar novedades (faltantes, sobrantes, vencidos, dañados).
5. **Registrar la temperatura y la humedad** del compartimiento (cadena de frío).

Reglas que la app debe respetar:

- **Solo el rol `paramedico`.** El conductor recibe `403`, así que no le muestre el menú.
- **La ambulancia la conoce el backend** por el token y el turno. **Nunca envíe** `ambulanciaId`, `ubicacionId`, `origenUbicacionId` ni `destinoUbicacionId`. Si los envía, recibe `400`.
- Si no ha seleccionado ambulancia, todas las rutas responden `422` con el mensaje *"Seleccione su ambulancia antes de gestionar el inventario"*. Llévelo a la selección de ambulancia.
- La bodega, los insumos, los lotes y los perfiles **se administran en la web**: la app no los crea.

---

## 2. Conceptos que debe entender la app

### 2.1 Cómo se identifica cada elemento

Cada insumo tiene un `control` que dice qué identificadores enviar al consumir, devolver o contar:

| `control` | Ejemplo | Qué enviar |
| --- | --- | --- |
| `insumo` | Gasas, guantes | Solo `insumoId` |
| `lote` | Medicamentos | `insumoId` + `loteId` |
| `serie` | Desfibrilador | `insumoId` + `equipoId` (cantidad siempre 1) |

**No lo calcule:** cada fila de `existencias` (sección 4) ya trae `insumoId`, `loteId` y `equipoId` con los valores correctos. Reenvíe esos mismos valores.

### 2.2 Cantidades

Son números con **hasta 3 decimales** (por ejemplo, `0.5` litros) y mayores que 0. Los equipos se mueven de a 1.

### 2.3 Utilizable

Una existencia es `utilizable: false` si su lote **venció** o si es un equipo que **no está operativo**. Muéstrela en rojo. El backend **no deja consumirla** (`422`).

---

## 3. Endpoints

Prefijo `/api/v1`, con `Authorization: Bearer <tokenAcceso>`.

| Método | Ruta | Para qué |
| --- | --- | --- |
| GET | `/mi-inventario` | Pantalla principal: existencias, dotación y verificación en curso |
| POST | `/mi-inventario/consumos` | Registrar lo usado (se descuenta al instante) |
| GET | `/mi-inventario/bodegas` | Bodegas a las que se puede devolver |
| POST | `/mi-inventario/devoluciones` | Devolver a una bodega (queda pendiente) |
| GET | `/mi-inventario/movimientos?tipo=&estado=&desde=&hasta=&pagina=&limite=` | Historial de la ambulancia |
| GET | `/mi-inventario/movimientos/{id}` | Detalle de un movimiento |
| POST | `/mi-inventario/controles-almacenamiento` | Temperatura y humedad |
| GET | `/mi-inventario/verificacion` | La verificación abierta (o `null`) |
| POST | `/mi-inventario/verificacion` | Iniciar una verificación |
| PUT | `/mi-inventario/verificacion/conteos` | Guardar conteos |
| POST | `/mi-inventario/verificacion/finalizar` | Cerrar la verificación |
| GET | `/mi-inventario/verificaciones?estado=&tipo=&desde=&hasta=&pagina=&limite=` | Verificaciones anteriores |
| GET | `/mi-inventario/verificaciones/{id}` | Detalle de una verificación |
| GET | `/inventario/insumos?busqueda=&pagina=&limite=` | Catálogo (solo lectura), para contar algo que no aparece |
| GET | `/inventario/lotes?insumoId=&busqueda=` | Lotes de un insumo (solo lectura) |

Las fechas de los filtros van en formato `AAAA-MM-DD` y corresponden al día en Colombia.

---

## 4. `GET /mi-inventario`: la pantalla principal

```json
{
  "ambulanciaId": "uuid",
  "ambulanciaCodigo": "AMB-02",
  "fecha": "2026-11-11",
  "ubicacion": { "id": "uuid", "tipo": "ambulancia", "nombre": "AMB-02", "bodegaId": null, "ambulanciaId": "uuid", "activa": true },
  "perfil": { "id": "uuid", "codigo": "DOT-TAB", "nombre": "Dotación TAB", "version": 2 },
  "completa": false,
  "items": [
    {
      "insumoId": "uuid", "insumoCodigo": "GASA-01", "insumoNombre": "Gasa estéril", "unidadMedida": "unidad",
      "detallePerfilId": "uuid", "cantidadRequerida": 25, "cantidadMinima": 20, "obligatorio": true,
      "disponible": 12, "noUtilizable": 0, "faltante": 13, "estado": "bajo_minimo"
    }
  ],
  "adicionales": [
    { "insumoId": "uuid", "insumoCodigo": "GUA-01", "insumoNombre": "Guantes", "unidadMedida": "par", "disponible": 50, "noUtilizable": 0 }
  ],
  "existencias": [
    {
      "id": "uuid", "ubicacionId": "uuid", "ubicacionTipo": "ambulancia", "ubicacionNombre": "AMB-02",
      "insumoId": "uuid", "insumoCodigo": "ADR-01", "insumoNombre": "Adrenalina 1 mg", "unidadMedida": "ampolla",
      "loteId": "uuid", "numeroLote": "L-1", "loteVencimiento": "2027-06-30",
      "equipoId": null, "numeroSerie": null, "equipoEstado": null,
      "claveControl": "lote:uuid", "cantidad": 7, "utilizable": true, "actualizadaEn": "…"
    }
  ],
  "verificacionAbierta": null
}
```

Cómo mostrarlo:

- **`items`** es la dotación comparada con el perfil. `estado`:
  - `completo`: verde.
  - `incompleto`: amarillo; está entre el mínimo y lo requerido.
  - `bajo_minimo`: rojo; es crítico.
- **`completa`**: `true` si todos los obligatorios están completos. Es `null` si el tipo de ambulancia **no tiene un perfil vigente**: muestre solo las existencias y el aviso *"Sin perfil de dotación"*.
- **`adicionales`**: lo que hay en la ambulancia y el perfil no pide.
- **`existencias`**: el detalle por lote y por equipo. **Es la lista que se usa para consumir, devolver y contar.**
- **`verificacionAbierta`**: si no es `null`, ofrezca *"Continuar verificación"*.

---

## 5. Consumos: `POST /mi-inventario/consumos`

```json
{
  "asignacionId": "uuid-del-servicio",
  "observaciones": "Paciente politraumatizado",
  "lineas": [
    { "insumoId": "uuid-gasa", "cantidad": 2 },
    { "insumoId": "uuid-adrenalina", "loteId": "uuid-lote", "cantidad": 1 }
  ]
}
```

- `asignacionId` es **opcional**. Envíelo si el consumo fue en un servicio. Debe ser un servicio **de esta ambulancia y de su turno**; si no, recibe `422`. El id lo tiene la pantalla del servicio (`/mi-servicio`).
- Entre 1 y 200 líneas. **No repita** la misma unidad en dos líneas: súmelas en una.
- Respuesta `201`: el movimiento con `estado: "confirmado"`. Vuelva a pedir `GET /mi-inventario` para refrescar.

Errores:

| Código | Cuándo | Qué mostrar |
| --- | --- | --- |
| `409` | No hay suficiente. El mensaje dice cuánto hay: *"No alcanza Gasa estéril en AMB-02: hay 3 y se necesitan 5"* | El mensaje; refresque las existencias |
| `422` | Lote vencido, equipo no operativo, servicio ajeno, falta el lote o la serie | El mensaje |
| `404` | Insumo, lote, equipo o servicio inexistente | *"No encontrado"*; refresque |

Si dos paramédicos consumen al mismo tiempo, el backend **nunca deja la existencia negativa**: el que llega tarde recibe `409`.

---

## 6. Devoluciones

1. `GET /mi-inventario/bodegas` → `[{ "id": "uuid", "codigo": "BOD-CENTRAL", "nombre": "Bodega central" }]`
2. `POST /mi-inventario/devoluciones`

```json
{
  "bodegaId": "uuid",
  "motivo": "Sobrante del turno",
  "lineas": [{ "insumoId": "uuid", "loteId": "uuid", "cantidad": 2 }]
}
```

- Respuesta `201` con `estado: "borrador"`. **Todavía no descuenta**: lo devuelto sigue en la ambulancia hasta que la bodega lo recibe y lo **confirma** desde la web.
- En el historial muestre las devoluciones en `borrador` como *"Pendiente de recibir"*. Si la bodega la rechaza, el movimiento queda `anulado`.

---

## 7. Historial: `GET /mi-inventario/movimientos`

Devuelve todos los movimientos que **entran o salen** de la ambulancia: abastecimientos de la bodega (`transferencia`), consumos, devoluciones, ajustes y bajas. Cada movimiento trae `codigo`, `tipo`, `estado`, `origen`, `destino`, `realizadoEn`, `usuarioNombre` y sus `lineas`. Para saber si algo entró o salió, compare `destino.id` con `ubicacion.id`.

Un movimiento de otra ambulancia responde `404`.

---

## 8. Verificación del inventario

La verificación es un **conteo físico** de la ambulancia comparado con lo que dice el sistema. **No cambia las existencias**: las novedades las revisa y corrige la bodega.

### 8.1 Iniciar: `POST /mi-inventario/verificacion`

```json
{ "tipo": "inicio_turno", "observaciones": null }
```

`tipo` admite `inicio_turno`, `fin_turno` o `extraordinaria`.

- Solo hay **una verificación abierta por ambulancia**. Si ya existe una, responde `200` con esa verificación y `creada: false`; si la crea, responde `201`. Tocar dos veces el botón **no duplica** nada.

### 8.2 Contar: `PUT /mi-inventario/verificacion/conteos`

Arme la lista a partir de `existencias` (una fila por lote o equipo). Puede guardar por partes:

```json
{
  "conteos": [
    { "insumoId": "uuid-gasa", "cantidadEncontrada": 28 },
    { "insumoId": "uuid-adr", "loteId": "uuid-lote", "cantidadEncontrada": 6 },
    { "insumoId": "uuid-dea", "equipoId": "uuid-equipo", "cantidadEncontrada": 1, "estado": "danado", "observaciones": "Pantalla rota" }
  ]
}
```

- **No envíe la cantidad esperada**: el backend la toma del sistema y la devuelve en `cantidadEsperada`.
- **`estado` es opcional.** Si no lo envía, el backend lo calcula:
  - igual a lo esperado → `conforme`
  - menos → `faltante`
  - más → `sobrante`
  - lote vencido con unidades → `vencido`
- Envíe `estado` solo para marcar **`danado`** (exige `observaciones`) o **`vencido`** (si el lote no figura vencido, exige `observaciones`). Si envía un estado que contradice las cantidades, recibe `422`.
- Un equipo se cuenta como 0 o 1.
- **Contar otra vez la misma unidad reemplaza** el conteo anterior.
- Para reportar algo que **no aparece** en las existencias (un sobrante), búsquelo con `GET /inventario/insumos` y, si va por lote, con `GET /inventario/lotes?insumoId=…`.

La respuesta trae la verificación con `conteos` (cada uno con `cantidadEsperada`, `cantidadEncontrada` y `estado`) y `totalNovedades`.

### 8.3 Finalizar: `POST /mi-inventario/verificacion/finalizar`

```json
{ "observaciones": "Revisión de inicio de turno" }
```

- Las de `inicio_turno` y `fin_turno` exigen **contar todo** lo que hay. Si falta algo, recibe `422` con la lista: *"Faltan por contar: Adrenalina 1 mg (lote L-1) · DEA (serie S-1)"*.
- La `extraordinaria` puede reportar **solo una novedad**.
- Queda `completada` si todo está conforme, o `con_novedades` si no. La central ve las que tienen novedades.
- Ya finalizada, no se edita: contar de nuevo responde `404` porque no hay verificación abierta.
- **Después la central revisa las novedades.** Cada verificación trae `pendienteDeRevision` (`true` mientras nadie las atienda) y `revision`, que es `null` o `{ revisadaPorNombre, revisadaEn, resolucion }`. En el historial (`GET /mi-inventario/verificaciones`, con el filtro opcional `revisada=true|false`) muestre *"Pendiente de revisión"* o *"Atendida por {revisadaPorNombre}: {resolucion}"*. **La app no revisa:** solo lo muestra.

### 8.4 Pantallas sugeridas

1. Resumen (`GET /mi-inventario`) con el botón **Verificar**.
2. Lista de conteo agrupada por insumo, con un campo numérico por lote o equipo y el estado calculado al guardar.
3. Botón **Finalizar** que muestre lo pendiente si el backend responde `422`.

---

## 9. Temperatura y humedad: `POST /mi-inventario/controles-almacenamiento`

```json
{ "temperatura": 4.5, "humedad": 55, "observaciones": "Nevera de medicamentos" }
```

- Envíe al menos una lectura. La temperatura va entre −50 y 100 °C y la humedad entre 0 y 100 %, con hasta 2 decimales.
- `registradoEn` es opcional (ISO 8601, no futura). Por defecto se toma la hora actual.

---

## 10. Errores comunes

El cuerpo de error es `{ "codigoEstado", "error", "mensaje", "ruta", "fecha" }`. **Muestre `mensaje`**: está en español y es claro para el usuario.

| Código | Significado |
| --- | --- |
| `400` | Campo inválido, campo no permitido o cantidad con más de 3 decimales |
| `401` | Sesión vencida: lleve al login |
| `403` | No es paramédico, o no es el paramédico de la ambulancia |
| `404` | No existe o no es de su ambulancia |
| `409` | Existencia insuficiente, o alguien cambió el dato al mismo tiempo: refresque |
| `422` | Regla de negocio (sin ambulancia, inventario inactivo, lote vencido, falta contar…) |

---

## 11. Lo que aún no existe

- **Tiempo real:** no hay eventos WebSocket del inventario. Refresque al volver a la pantalla o al terminar cada operación.
- **Sin señal:** no hay cola fuera de línea. Si no hay conexión, no permita registrar; los consumos se deben registrar cuando vuelva la señal.

---

## Datos de prueba

En desarrollo, `npm run db:semilla` carga 80 insumos y los perfiles `DOT-TAB` y `DOT-TAM`, y `npm run db:semilla:inventario-demo` carga lo siguiente:

- la bodega `BOD-CENTRAL`;
- lotes y registros `DEMO-…`;
- equipos `DEMO-EQ-…`;
- todas las ambulancias abastecidas según su perfil.

Las alertas ya traen un lote vencido, uno por vencer, un mantenimiento próximo y un insumo bajo el mínimo.
