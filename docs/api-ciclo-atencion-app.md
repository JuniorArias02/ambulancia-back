# Ciclo de atención — guía para la app móvil (Flutter)

**Para:** el equipo de la app de la tripulación (`ambulancia/app`).
**Complementa a:** [`api-app-movil.md`](api-app-movil.md) (login, `/mi-servicio`, GPS) y [`api-rutas-frontend.md`](api-rutas-frontend.md) (ruta).

> ⚠️ **Hay cambios que rompen lo que ya existe** (sección 6): ahora hay una etapa nueva (`atendiendo`), la llegada exige GPS y solo la confirma el conductor, y cerrar sin traslado exige un motivo. Revise los botones del servicio.

---

## 1. El ciclo completo

```text
asignada ──► en_camino ──► en_escena ──► atendiendo ──► trasladando ──► finalizada
despacho    "Salimos"     "Llegué"      "Atendiendo     "Paciente       "Entregado /
(central)                 CONDUCTOR     al paciente"    a bordo"        Finalizar"
                          + GPS
                             │               │
                             └──► finalizada ◄┘   (sin traslado: requiere motivo)
```

| Estado | Botón sugerido | Quién lo marca | Qué guarda el backend |
| --- | --- | --- | --- |
| `asignada` | — (lo pone la central al despachar) | despachador | `asignadaEn` |
| `en_camino` | **Salimos** | conductor o paramédico del turno | `salidaEn` |
| `en_escena` | **Llegué** | **solo el conductor**, con GPS | `llegadaEscenaEn` + posición y distancia a la emergencia |
| `atendiendo` | **Atendiendo al paciente** | conductor o paramédico | `atencionInicioEn` |
| `trasladando` | **Paciente a bordo / Iniciar traslado** | conductor o paramédico | `salidaEscenaEn` |
| `finalizada` | **Paciente entregado** (desde `trasladando`) o **Finalizar sin traslado** (desde `en_escena` / `atendiendo`, con motivo) | conductor o paramédico | `finalizadaEn` (y `llegadaDestinoEn` si hubo traslado) |

**Pinte los botones con `asignacion.siguientesEstados`.** El backend dice qué pasos se pueden dar ahora: no los calcule en la app.

| `siguientesEstados` | Botones |
| --- | --- |
| `["en_camino"]` | Salimos |
| `["en_escena"]` | Llegué (solo el conductor; al paramédico muéstrele "Esperando que el conductor confirme la llegada") |
| `["atendiendo", "finalizada"]` | Atendiendo al paciente · *Finalizar sin traslado* (secundario) |
| `["trasladando", "finalizada"]` | Paciente a bordo · *Finalizar sin traslado* (secundario) |
| `["finalizada"]` | Paciente entregado |
| `[]` | Ninguno (servicio terminado o cancelado) |

Cada paso queda registrado con **fecha y hora, quién lo marcó y su rol** (sección 5).

---

## 2. Registrar un paso — `PATCH /asignaciones/{id}/avance`

`{id}` es `asignacion.id` de `GET /mi-servicio`.

```json
{ "estado": "atendiendo" }
```

| Campo | Cuándo |
| --- | --- |
| `estado` | Siempre: `en_camino`, `en_escena`, `atendiendo`, `trasladando` o `finalizada` |
| `latitud`, `longitud` | **Obligatorios en `en_escena`**. Recomendados en todos los pasos. Máximo 7 decimales |
| `precisionMetros` | Opcional: `posicion.accuracy` de Geolocator (1 decimal) |
| `observacion` | Obligatoria al **finalizar sin traslado** y al **confirmar la llegada fuera del radio**. De 5 a 255 caracteres |
| `confirmarFueraDeRadio` | Solo en `en_escena`, junto con `observacion` (ver sección 3) |

**200**: la `Asignacion` actualizada (la misma forma de `/mi-servicio`), con su nuevo `estado` y `siguientesEstados`.

| Código | Mensaje (ejemplos) | Qué hacer |
| --- | --- | --- |
| `403` | "Solo el conductor de la ambulancia asignada puede confirmar la llegada" | No mostrar "Llegué" al paramédico |
| `403` | "Solo la tripulación asignada puede actualizar este servicio" | Volver a pedir `/mi-servicio` |
| `422` | "Envíe la ubicación GPS del celular para confirmar la llegada" | Pedir permiso de ubicación o esperar señal y reintentar |
| `422` | "Está a 340 m de la emergencia (radio de 100 m). Si ya llegó, confirme…" | Abrir el diálogo de la sección 3 |
| `422` | "Indique por qué se cierra el servicio sin trasladar al paciente" | Pedir el motivo |
| `422` | "No se puede pasar de en_camino a atendiendo" | Volver a pedir `/mi-servicio` (alguien más avanzó el servicio) |
| `409` | "La asignación cambió mientras tanto…" | Volver a pedir `/mi-servicio` |

### Sin duplicados (reintentos tranquilos)

**Repetir un paso que ya está hecho no es un error:** si "Llegué" se envía dos veces (doble toque, o un reintento porque no llegó la respuesta), el backend responde **`200`** con el servicio como está y **no registra nada nuevo**.

- Si un `PATCH` falla por red, **reintente el mismo paso**: es seguro.
- Igual, deshabilite el botón mientras espera la respuesta.

---

## 3. Confirmar la llegada ("Llegué") — solo el conductor

**Nunca es automática.** El backend usa un **radio de referencia** (`radioLlegadaMetros`, hoy 100 m, viene en `GET /mi-servicio`) para validar que el conductor está en el sitio, pero **siempre** es el conductor quien toca "Llegué".

### En la app

1. Con la posición del GPS y `emergencia.coordenadas`, calcule la distancia en el celular (por ejemplo, con `Geolocator.distanceBetween`).
2. **Dentro del radio:** resalte el botón **"Llegué"** (más grande, con vibración opcional). **No lo envíe solo**: lo tiene que tocar el conductor.
3. **Fuera del radio:** muestre el botón normal, con el texto "Estás a 340 m".
4. Al tocarlo, envíe la posición actual:

```json
{ "estado": "en_escena", "latitud": 7.90745, "longitud": -72.497, "precisionMetros": 6.0 }
```

### Si el backend dice que está lejos (`422` "Está a … m")

Muestre un diálogo: *"El GPS te ubica a 340 m de la emergencia. ¿Confirmas que ya llegaste?"*, con un campo de **motivo obligatorio** (ejemplos: "La dirección registrada estaba equivocada", "El paciente fue movido a otro punto", "Sin señal GPS precisa"). Al confirmar:

```json
{
  "estado": "en_escena",
  "latitud": 7.916,
  "longitud": -72.497,
  "confirmarFueraDeRadio": true,
  "observacion": "La dirección registrada estaba equivocada; el paciente está aquí"
}
```

Queda registrado como llegada **fuera de radio**, con el motivo, y la central lo ve.

- Si la emergencia no tiene coordenadas (solo dirección), no hay contra qué comparar: el backend acepta la llegada y la registra sin distancia.

---

## 4. Finalizar sin traslado

Desde `en_escena` o `atendiendo`, el botón secundario **"Finalizar sin traslado"** pide un motivo:

```json
{ "estado": "finalizada", "observacion": "Paciente atendido en el sitio, no requiere traslado" }
```

Motivos sugeridos (lista rápida + texto libre): *Atendido en el sitio* · *Rechaza el traslado (firma desistimiento)* · *Sin paciente en el lugar* · *Paciente trasladado por otra ambulancia*.

Desde `trasladando`, **"Paciente entregado"** no pide motivo.

Al finalizar, la ambulancia vuelve a quedar **disponible** y `GET /mi-servicio` trae `asignacion: null`.

---

## 5. Línea de tiempo del servicio — `GET /asignaciones/{id}/eventos`

La tripulación solo puede consultar la de su propio servicio (`403` si es otro).

**200**
```json
[
  { "id": "uuid", "estadoAnterior": null, "estadoNuevo": "asignada", "ocurridoEn": "2026-10-25T14:45:17.000Z",
    "responsable": { "id": "uuid", "nombreCompleto": "Laura Gómez", "rol": "despachador" },
    "posicion": null, "precisionMetros": null, "distanciaEscenaMetros": null, "fueraDeRadio": false, "observacion": null },
  { "id": "uuid", "estadoAnterior": "en_camino", "estadoNuevo": "en_escena", "ocurridoEn": "2026-10-25T14:58:02.000Z",
    "responsable": { "id": "uuid", "nombreCompleto": "Carlos Pérez", "rol": "conductor" },
    "posicion": { "latitud": 7.90745, "longitud": -72.497 }, "precisionMetros": 6, "distanciaEscenaMetros": 50, "fueraDeRadio": false, "observacion": null }
]
```

Úsela para una vista "Detalle del servicio" con horas: despacho 14:45 · salida 14:46 · llegada 14:58 · etc.

---

## 6. Qué debe ajustar la app (resumen)

1. **Nuevo estado `atendiendo`**: agréguelo a los modelos, a los textos y a los botones ("Atendiendo al paciente").
2. **"Llegué"**: mostrarlo **solo al conductor** (`turno.integrantes[].funcion == 'conductor'` para el usuario actual) y enviar **siempre** `latitud` y `longitud`. Manejar el `422` de "fuera del radio" con el diálogo de la sección 3.
3. **Resaltar "Llegué"** al entrar en `radioLlegadaMetros` (campo nuevo de `GET /mi-servicio`), **sin enviarlo automáticamente**.
4. **"Finalizar sin traslado"**: pedir `observacion`.
5. **Botones según `siguientesEstados`**: ya no hay paso directo de `en_escena` a `trasladando`; ahora pasa por `atendiendo`.
6. **Reintentos**: un `PATCH` repetido es seguro (responde `200` sin duplicar).
7. Opcional: enviar `latitud`, `longitud` y `precisionMetros` en **todos** los pasos (queda en el registro y sirve para auditoría).
8. **Ruta:** sigue igual. Solo existe en `asignada` y `en_camino`; desde la llegada deja de mostrarse.

### Campos nuevos en las respuestas

| Dónde | Campo |
| --- | --- |
| `GET /mi-servicio` | `radioLlegadaMetros` (número) |
| `Asignacion` | `atencionInicioEn` (fecha o `null`) |
| `Asignacion.estado` / `siguientesEstados` | Valor nuevo `atendiendo` |

### Textos de estado

| Valor | Texto |
| --- | --- |
| `asignada` | Asignada |
| `en_camino` | En camino |
| `en_escena` | En la escena |
| `atendiendo` | Atendiendo al paciente |
| `trasladando` | Trasladando paciente |
| `finalizada` | Finalizada |
| `cancelada` | Cancelada por la central |

---

## 7. Modelos Dart (cambios)

```dart
enum EstadoAsignacion { asignada, enCamino, enEscena, atendiendo, trasladando, finalizada, cancelada }

class Asignacion {
  // …campos existentes…
  final DateTime? atencionInicioEn; // nuevo
}

class MiServicio {
  final Turno? turno;
  final Asignacion? asignacion;
  final Emergencia? emergencia;
  final int radioLlegadaMetros; // nuevo
}

class EventoAsignacion {
  final String id;
  final String? estadoAnterior;
  final String estadoNuevo;
  final DateTime ocurridoEn;
  final ({String id, String? nombreCompleto, String? rol})? responsable;
  final ({double latitud, double longitud})? posicion;
  final double? precisionMetros, distanciaEscenaMetros;
  final bool fueraDeRadio;
  final String? observacion;
}
```

Ejemplo del botón "Llegué":

```dart
Future<void> confirmarLlegada({String? motivoFueraDeRadio}) async {
  final p = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.best);
  double r(double v) => double.parse(v.toStringAsFixed(7));
  await cliente.patch('/asignaciones/${asignacion.id}/avance', data: {
    'estado': 'en_escena',
    'latitud': r(p.latitude),
    'longitud': r(p.longitude),
    'precisionMetros': double.parse(p.accuracy.toStringAsFixed(1)),
    if (motivoFueraDeRadio != null) ...{
      'confirmarFueraDeRadio': true,
      'observacion': motivoFueraDeRadio,
    },
  });
}
```
