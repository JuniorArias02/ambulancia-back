# Ruta hacia la institución médica

## 1. Resumen

Cuando el paciente va a bordo (`estado = trasladando`), el backend calcula la ruta por calles desde la posición reciente de la ambulancia hasta el hospital que eligió el conductor. La app solo la dibuja: **no calcula rutas ni llama a Geoapify**.

| Necesidad | Endpoint | Novedad |
| --- | --- | --- |
| Lista de hospitales, del más cercano al más lejano | `GET /instituciones-salud` | Sin cambios |
| **Elegir o cambiar el hospital (solo conductor)** | `PUT /asignaciones/{id}/destino` | **Nuevo** |
| Saber a qué hospital se va (conductor y paramédico) | `GET /mi-servicio` → `asignacion.institucionDestino` | Campo nuevo |
| Marcar "Paciente a bordo" y "Paciente entregado" | `PATCH /asignaciones/{id}/avance` | Sin cambios |
| Obtener la ruta | `GET /asignaciones/{id}/ruta` | Nuevo tramo y motivos |
| Enviar la posición | `POST /ubicaciones` | Sin cambios |

No hay eventos nuevos de WebSocket.

---

## 2. Quién hace qué

| Acción | Conductor del servicio | Paramédico o médico | Central (web) |
| --- | --- | --- | --- |
| Elegir o cambiar el hospital | **Sí** | No (`403`) | No (`403`) |
| Ver el hospital | Sí | Sí | Sí |
| Ver la ruta | Sí | Sí | Sí |
| Registrar el hospital de entrega en la HC | No (sin acceso a la HC) | Sí | No |

**El paramédico nunca debe ver el selector de destino del servicio.** Solo lo consulta.

**El destino del servicio y el de la HC son independientes:**
- `asignacion.institucionDestino`: a dónde va la ambulancia.
- `institucionDestinoId` de la HC: dónde se entregó realmente a cada paciente. Cambiarlo no cambia el servicio, y viceversa.

---

## 3. Flujo

```
en_escena / atendiendo
   │  (Opcional) El conductor elige el hospital
   │     GET /instituciones-salud?activa=true&limite=50&latitud=…&longitud=…
   │     PUT /asignaciones/{id}/destino
   ▼
"Paciente a bordo": PATCH /asignaciones/{id}/avance { "estado": "trasladando" }
   │  Con hospital: el backend calcula la ruta. Sin hospital: no se bloquea
   ▼
trasladando
   │  Sin hospital → el conductor ve "Elija el hospital"; el paramédico, "Sin hospital definido"
   │  Con hospital → ruta y ETA: GET /asignaciones/{id}/ruta
   │  Si cambia el hospital: PUT otra vez. La ruta anterior deja de ser válida
   ▼
"Paciente entregado": PATCH /asignaciones/{id}/avance { "estado": "finalizada" }
```

---

## 4. Contratos

Prefijo `/api/v1`, con `Authorization: Bearer`.

### 4.1 `PUT /asignaciones/{id}/destino`

Solo el conductor del turno de ese servicio. Estados permitidos: `en_escena`, `atendiendo`, `trasladando`.

```json
{ "institucionId": "uuid" }
```

Responde `200` con la asignación completa (sección 4.2).

**Se puede reintentar:** repetir el mismo hospital responde `200` y no recalcula ni registra nada.

| Código | Cuándo | Qué hacer |
| --- | --- | --- |
| `400` | Id inválido o campos de más | Error de programación |
| `401` | Sesión vencida | Flujo normal de sesión |
| `403` | No es el conductor de este servicio | Recargar `/mi-servicio` |
| `404` | La asignación o la institución no existe | Recargar la lista |
| `409` | El servicio cambió de estado mientras tanto | Recargar `/mi-servicio` |
| `422` | Institución inactiva o sin coordenadas, o estado no permitido | Mostrar `mensaje` y recargar |

Los errores usan la forma de siempre; muestre `mensaje`:

```json
{ "codigoEstado": 422, "error": "...", "mensaje": "H Sin Mapa no tiene coordenadas; no se puede trazar la ruta", "ruta": "...", "fecha": "..." }
```

### 4.2 Campos nuevos en la asignación

Llegan en `/mi-servicio` → `asignacion`, en `mi_servicio.actualizado` y en toda respuesta de asignación. **Los demás campos no cambian.**

```json
{
  "institucionDestino": {
    "id": "uuid",
    "nombre": "Hospital Erasmo Meoz",
    "direccion": "Av. 11E # 5AN-71",
    "telefono": "+57 607…",
    "coordenadas": { "latitud": 7.9, "longitud": -72.49 }
  },
  "destinoActualizadoPor": { "id": "uuid", "nombreCompleto": "Pedro Díaz" },
  "destinoActualizadoEn": "2026-11-02T23:20:00.000Z"
}
```

Sin hospital, los tres valen `null`. `direccion`, `telefono` y `coordenadas` también pueden ser `null`: la institución pudo editarse después de elegirla.

### 4.3 `GET /asignaciones/{id}/ruta`

El cuerpo es el que ya convierte `ModeloRutaServicio`, con estos cambios:

| `asignacion.estado` | Respuesta |
| --- | --- |
| `asignada`, `en_camino` | `200`, `tramo: "hacia_emergencia"` |
| `en_escena`, `atendiendo` | `404` |
| `trasladando` con ruta vigente | `200`, `tramo: "hacia_destino"`; `destino` tiene las coordenadas del hospital |
| `trasladando` sin ruta todavía | `404` |
| `finalizada`, `cancelada` | `404` |

**Cambio de comportamiento:** antes, en la escena respondía `200` con la ruta vieja hacia la emergencia. Ya no.

`404` en `trasladando` **no es un error**. Con hospital: muestre "Calculando ruta…" y siga consultando. Sin hospital: muestre el aviso de la sección 3.

Valores de `motivo`:

| Valor | Significado |
| --- | --- |
| `despacho`, `sin_ruta`, `desvio` | Como hasta ahora; `sin_ruta` y `desvio` también aplican al tramo al hospital |
| `inicio_traslado` **(nuevo)** | Salió con hospital ya elegido |
| `cambio_destino` **(nuevo)** | Se eligió o cambió el hospital durante el traslado |

`MotivoRuta.desdeValor` convierte hoy los desconocidos en `despacho`: agregue los dos nuevos.

### 4.4 `GET /instituciones-salud`

Sin cambios. Ya lo llama `fuente_remota_historias.dart` (`listarInstituciones`): **reutilícelo**. Cada elemento trae `coordenadas` (`{ latitud, longitud }` o `null`), que hoy el modelo de la app no lee. Las que tengan `null` van al final y responden `422` si se eligen: **deshabilítelas en el selector**. `distanciaMetros` es en línea recta: muéstrelo con "≈".

### 4.5 `POST /ubicaciones`

Sin cambios, pero **el GPS debe seguir enviándose durante `en_escena` y `atendiendo`**:
- El backend solo usa como origen una posición de **10 minutos o menos**.
- Si la última es más vieja, no traza una ruta equivocada: espera el siguiente reporte y calcula con él (`motivo: "sin_ruta"`).

### 4.6 Tiempo real

| Evento | Uso |
| --- | --- |
| `mi_servicio.actualizado` | Estado e `institucionDestino` al día. El paramédico ve el hospital sin recargar. Ya lo usa la app |
| `asignacion.ruta_actualizada` | Trae `{ ruta }` con el cuerpo de `GET /ruta`, cada vez que se calcula una. **La app no lo escucha hoy.** Es opcional: consultar cada 30 s sigue siendo válido |

---

## 5. Cambios en Flutter

Rutas dentro de `app/lib/modules/`.

| Archivo | Cambio |
| --- | --- |
| `prehospital_care/domain/entities/institucion_salud.dart`, `data/models/modelo_catalogos_instituciones.dart` | Leer `coordenadas` |
| `assignments/domain/entities/asignacion.dart`, `data/models/modelo_mi_servicio.dart` | Agregar `institucionDestino` |
| `assignments/domain/entities/ruta_servicio.dart`, `data/models/modelo_ruta_servicio.dart` | Agregar `tramo` y los motivos nuevos |
| `assignments/data/sources/fuente_remota_mi_servicio.dart` y su repositorio | Agregar `definirDestino(asignacionId, institucionId)` |
| **Componente nuevo:** selector de hospital | **Solo conductor**, en `en_escena`, `atendiendo` y `trasladando`. Reutilice `listarInstituciones` con la posición actual |
| `assignments/components/botones_avance_servicio.dart` | Pasos sin cambios. Ofrezca el selector junto a "Paciente a bordo", **sin bloquearlo** |
| `assignments/components/vista_servicio_asignado.dart` | Ver abajo |
| `assignments/components/vista_servicio_paramedico.dart`, `tarjeta_emergencia_paramedico.dart` | Mostrar hospital y ETA, **sin selector** |
| `assignments/components/resumen_ruta.dart` | El texto dice "hacia la emergencia" u "hacia {hospital}" según `tramo` |
| Formulario de HC (`institucionDestinoId`) | Precargar con `institucionDestino` si está vacío. **El paramédico puede cambiarlo**, y eso no afecta el servicio |

### `vista_servicio_asignado.dart`

Hoy todo apunta a la emergencia y se apaga con `muestraRuta`:

| Elemento | `asignada`, `en_camino` | `trasladando` |
| --- | --- | --- |
| Coordenadas objetivo (`_tieneRuta`, marcador) | `emergencia.coordenadas` | `asignacion.institucionDestino.coordenadas` |
| `_navegar()` (Google Maps, Waze) | Emergencia | Hospital |
| Botón de navegación externa | Como hoy | Visible si hay hospital |
| Franja superior | `ResumenRuta` | `ResumenRuta` si hay hospital; si no, "Elija el hospital de destino" |

También:

- **No muestre una ruta anterior.** `rutaServicioProvider` es por `asignacion.id` y conserva el último valor mientras recarga, así que el trazado viejo puede seguir visible. Al cambiar el estado o el hospital, invalide el proveedor y **descarte toda ruta cuyo `tramo` no corresponda al estado o cuyo `destino` no coincida con `institucionDestino.coordenadas`**.
- **Cambie `EstadoAsignacion.muestraRuta` con cuidado:** también lo usan `tarjeta_servicio.dart` y `vista_servicio_paramedico.dart`. Y su comentario dice que la ruta solo existe antes de la escena, lo que ya no es cierto.
- La pantalla del conductor sigue encendida también en `trasladando`.

### Sin señal

- El `PUT` necesita conexión. Si falla, conserve la elección en pantalla y reintente: es seguro repetirlo.
- Con las coordenadas ya descargadas, Google Maps o Waze funcionan sin el backend.
- Un fallo de la ruta no debe detener el GPS.

---

## 6. Qué no hacer

- No llamar a Geoapify ni guardar su clave en la app.
- No leer la HC para saber el destino: el conductor recibe `403`.
- No enviar el hospital en `PATCH /avance`.
- No mostrar el selector al paramédico.
- No exigir hospital para "Paciente a bordo" ni "Paciente entregado".
- No validar en la app la llegada al hospital por distancia: el backend no lo exige.

---

## 7. Comprobado en el backend

Prueba real contra una copia temporal de la base, con Geoapify:

- Conductor elige → `200`. Paramédico, despachador, administrador y otro conductor → `403`.
- Inexistente → `404`. Inactiva, sin coordenadas o en un estado no permitido → `422`. Id inválido → `400`.
- Elegir en `atendiendo` y pasar a `trasladando` → ruta `hacia_destino`, `inicio_traslado`, desde la posición reciente.
- Cambiar de hospital → **nunca** se devuelve la ruta del anterior; luego llega `cambio_destino`. El reintento no recalcula.
- Traslado sin hospital → `200`, y la ruta se calcula al elegirlo.
- GPS de más de 10 minutos → no calcula; con el siguiente reporte, `sin_ruta` desde esa posición.
- Desvío → recalcula hacia el hospital actual.
- HC con otro hospital → el servicio no cambia.
- Eventos publicados: `mi_servicio.actualizado` y `asignacion.ruta_actualizada` a las salas de la tripulación y la central.

**No se probó:** la entrega final por socket (se usó un receptor HTTP en lugar del servidor `webSocket/`) ni la app. Compruébelo al integrar.

---

## 8. Pruebas sugeridas en la app

1. Conductor elige hospital en `atendiendo` → "Paciente a bordo" → aparecen ruta y ETA hacia ese hospital.
2. "Paciente a bordo" sin hospital → no se bloquea, aparece el aviso, elige y aparece la ruta.
3. El conductor elige → el paramédico lo ve sin recargar, y **no tiene selector**.
4. Cambiar de hospital durante el traslado → cambia el trazado y **nunca** se ve la ruta anterior ni la de la emergencia.
5. Institución sin coordenadas → no se puede elegir.
6. Google Maps o Waze abren hacia el hospital.
7. App con GPS detenido varios minutos → "Calculando ruta…"; al volver el GPS, aparece la ruta.
8. Abrir la HC → hospital precargado; cambiarlo no altera lo que ve el conductor.
9. "Paciente entregado" → desaparece la ruta.
