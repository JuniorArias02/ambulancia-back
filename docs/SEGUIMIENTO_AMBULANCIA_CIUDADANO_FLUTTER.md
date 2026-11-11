# Seguimiento de la ambulancia en "Mis reportes": guía para Flutter

**Para:** el agente de Flutter (`ambulancia/app`).
**Estado del backend (2026-11-04):**

| Parte | Estado |
| --- | --- |
| REST `GET /ciudadanos/emergencias/{id}/seguimiento` | **Listo**, probado con peticiones reales y en Swagger (`/api/docs`) |
| Campo `seguimientoDisponible` en "Mis reportes" | **Listo** |
| Evento WebSocket `seguimiento.actualizado` | La API ya lo emite. **El servidor `webSocket/` aún debe aceptarlo**: hoy rechaza al rol ciudadano. Implemente primero el REST; el WebSocket es una mejora |

**Complementa a:** [`INTEGRACION_MODULO_CIUDADANO_FLUTTER.md`](INTEGRACION_MODULO_CIUDADANO_FLUTTER.md) (sección G, "Mis reportes").

---

## 1. Qué ve el ciudadano

1. En **"Mis reportes"**, los reportes con una ambulancia **en camino** muestran el botón **"Ver ambulancia"**.
2. El botón abre un mapa con:
   - el **lugar del reporte**;
   - la **ambulancia** (posición, código y tipo);
   - la **etapa** (asignada o en camino);
   - el **trazado y el tiempo estimado** hasta el lugar.
3. **El seguimiento termina en cuanto la ambulancia llega al lugar del reporte.** Desde ese momento el ciudadano ya no ve la posición, ni durante la atención ni en el traslado.

**Lo que nunca recibe:** la placa, la tripulación, la posición después de la llegada, el hospital de destino ni datos de otros reportes.

---

## 2. El botón en "Mis reportes"

`GET /ciudadanos/emergencias` y `GET /ciudadanos/emergencias/{id}` traen un campo nuevo en cada reporte:

```json
{ "seguimientoDisponible": true }
```

| `seguimientoDisponible` | Qué hacer |
| --- | --- |
| `true` | Mostrar **"Ver ambulancia"** |
| `false` | Ocultarlo. Si el `estado` es `recibida`: "La central está revisando su reporte". Si es `en_atencion`: "La ambulancia ya llegó al lugar" |

Es `true` solo con la emergencia `despachada`, es decir, con una ambulancia en camino que aún no llega.

---

## 3. Endpoint: `GET /ciudadanos/emergencias/{id}/seguimiento`

- Token del ciudadano (`Authorization: Bearer`). Solo el rol `ciudadano`.
- `{id}` es el `id` del reporte, el mismo de "Mis reportes".
- **Solo reportes propios:** uno ajeno o inexistente responde `404`.
- Límite: 30 consultas por minuto.

### Respuesta `200`, con ambulancia en camino

```json
{
  "emergenciaId": "2f1c3c1e-8a0e-4c7b-9d0a-7b8f6f1e2a10",
  "numeroEmergencia": "EMG-20261104-0003",
  "estadoEmergencia": "despachada",
  "disponible": true,
  "motivoNoDisponible": null,
  "ambulancias": [
    {
      "ambulanciaCodigo": "AMB-01",
      "tipoAmbulancia": "TAB",
      "etapa": "en_camino",
      "ubicacion": {
        "latitud": 7.9,
        "longitud": -72.5,
        "registradaEn": "2026-11-04T15:20:03.120Z",
        "desactualizada": false
      },
      "llegada": {
        "distanciaMetros": 1413,
        "duracionSegundos": 127,
        "llegadaEstimada": "2026-11-04T15:22:10.000Z",
        "geometria": {
          "type": "LineString",
          "coordinates": [[-72.5, 7.9], [-72.4985, 7.9032], [-72.497, 7.907]]
        }
      }
    }
  ],
  "consultadoEn": "2026-11-04T15:20:05.004Z",
  "intervaloSugeridoSegundos": 10
}
```

### Respuesta `200`, la ambulancia ya llegó

```json
{
  "emergenciaId": "2f1c3c1e-8a0e-4c7b-9d0a-7b8f6f1e2a10",
  "numeroEmergencia": "EMG-20261104-0003",
  "estadoEmergencia": "en_atencion",
  "disponible": false,
  "motivoNoDisponible": "ambulancia_en_el_lugar",
  "ambulancias": [],
  "consultadoEn": "2026-11-04T15:40:00.000Z",
  "intervaloSugeridoSegundos": 10
}
```

### Campos

| Campo | Detalle |
| --- | --- |
| `disponible` | `true`: hay al menos una ambulancia en camino que aún no llega al lugar |
| `motivoNoDisponible` | `null` si está disponible. `sin_ambulancia_asignada`: la central aún no despacha, siga consultando. `ambulancia_en_el_lugar`: ya llegó, **deje de consultar**. `finalizado`: la emergencia terminó, **deje de consultar** |
| `ambulancias` | Una por ambulancia en camino; puede haber varias si hay varias víctimas. Vacío si no está disponible |
| `ambulanciaCodigo` | Ej. `AMB-01`, para la etiqueta del marcador |
| `tipoAmbulancia` | `TAB` (básica) o `TAM` (medicalizada) |
| `etapa` | `asignada` o `en_camino` (después de llegar ya no aparece) |
| `ubicacion` | Última posición del GPS de la ambulancia. **`null`** si no hay una posición de los últimos 10 minutos |
| `ubicacion.desactualizada` | `true` si tiene más de 2 minutos: marcador gris y texto "Ubicación aproximada" |
| `llegada` | Ruta hasta el lugar del reporte. `null` mientras el backend no la ha calculado (por ejemplo, sin GPS reciente) |
| `llegada.geometria` | GeoJSON `LineString`. **Cada par es `[longitud, latitud]`**: inviértalo para `LatLng(latitud, longitud)` |
| `llegada.llegadaEstimada` | Sin tráfico en vivo: muéstrela con "≈" ("Llega en ≈ 2 min") |
| `intervaloSugeridoSegundos` | Cada cuánto volver a consultar (10) |

**Coordenadas del lugar del reporte:** están en el propio reporte (`coordenadas` de "Mis reportes"). Este endpoint no las repite.

### Textos sugeridos por etapa

| `etapa` | Texto |
| --- | --- |
| `asignada` | Ambulancia asignada, saliendo |
| `en_camino` | Ambulancia en camino · Llega en ≈ X min |

Al llegar, la respuesta trae `disponible: false` y `motivoNoDisponible: "ambulancia_en_el_lugar"`. Muestre **"La ambulancia llegó al lugar"** y cierre el mapa.

### Errores

| Código | Qué hacer |
| --- | --- |
| `401` | Sesión vencida: login, como en el resto de la app |
| `403` | El usuario no es ciudadano: cerrar sesión |
| `404` | El reporte no existe o no es suyo: volver a "Mis reportes" |
| `429` | Consultó demasiado rápido: espere `intervaloSugeridoSegundos` |
| `500` / sin red | Mantenga el último dato en el mapa con "Sin conexión" y reintente en el siguiente ciclo |

---

## 4. Cómo mantener el mapa al día

### Opción A, disponible hoy: consultar cada 10 segundos

1. Al abrir el mapa: `GET …/seguimiento`.
2. Repita cada `intervaloSugeridoSegundos` **solo con la pantalla visible**. Pause al ir a segundo plano y reanude al volver.
3. Mueva el marcador **animando** de la posición anterior a la nueva (~1 s), sin saltos.
4. Redibuje el trazado si cambia `llegada.geometria`.
5. Detenga el ciclo con `disponible: false` y `motivoNoDisponible` en `ambulancia_en_el_lugar` o `finalizado`. Muestre "La ambulancia llegó al lugar" (o "El servicio terminó") y un botón para volver.
6. Con `sin_ambulancia_asignada` (por ejemplo, la central canceló la ambulancia antes de llegar): "Esperando una ambulancia". Siga consultando, pero cada 30 s.

### Opción B, cuando el servidor WebSocket lo habilite: evento `seguimiento.actualizado`

**No la active hasta que se confirme que el servidor `webSocket/` aceptó el rol ciudadano.** Hoy responde `error_autenticacion` a un token de ciudadano.

- Conexión: la misma que usa la tripulación. `{TIEMPO_REAL_URL}/tiempo-real` con `setAuth({'token': tokenAcceso})` (ver `api-tiempo-real-frontend.md`, sección 6). El servidor une al ciudadano **solo a su sala personal**.
- Evento:

```json
{
  "id": "6bb7d68d-2f8c-481b-a911-752b18ad531c",
  "tipo": "seguimiento.actualizado",
  "ocurridoEn": "2026-11-04T15:20:03.500Z",
  "datos": {
    "seguimiento": { "…": "mismo objeto que la respuesta del GET de la sección 3" }
  }
}
```

- **Cuándo llega:**
  - cuando se despacha una ambulancia;
  - con cada movimiento de la ambulancia **mientras va hacia el lugar** (máximo uno cada 3 s);
  - con cada recálculo de la ruta hacia el lugar;
  - **al llegar**, con un evento `disponible: false` y `motivoNoDisponible: "ambulancia_en_el_lugar"`. Después de eso ya no llegan posiciones; solo avisos sin posición si la emergencia cambia (por ejemplo, `finalizado` al cerrarse).
- **Uso:** si el mapa de ese reporte está abierto (`datos.seguimiento.emergenciaId`), reemplace el estado con `datos.seguimiento`. Descarte los repetidos por `id`.
- **El GET sigue siendo necesario:**
  - al abrir el mapa;
  - al reconectar (evento `conectado`);
  - y como respaldo: si no llega ningún evento en 30 s, consulte una vez.
- Con el WebSocket conectado, **apague la consulta cada 10 s** y deje solo el respaldo.

---

## 5. Cuándo termina el seguimiento

| Situación | Lo que responde el backend |
| --- | --- |
| La central aún no despacha (`recibida`) | `disponible: false`, `sin_ambulancia_asignada` |
| La ambulancia salió o va en camino | `disponible: true` |
| **La ambulancia llegó al lugar** (y después: atención y traslado) | `disponible: false`, `ambulancia_en_el_lugar` |
| La emergencia se cerró (entrega o fin de la atención) | `disponible: false`, `finalizado` |
| La central canceló la emergencia (`cancelada`) | `disponible: false`, `finalizado` |
| La central canceló la ambulancia antes de llegar y la emergencia vuelve a `recibida` | `disponible: false`, `sin_ambulancia_asignada` |

---

## 6. Privacidad

- Solo funciona para **reportes propios**. La API lo comprueba en cada consulta, aunque se conozca el id de otro reporte.
- No guarde las posiciones de la ambulancia en el celular después de cerrar el mapa, ni las envíe a analítica.

---

## 7. Pruebas sugeridas

1. Reporte recién enviado: sin botón "Ver ambulancia".
2. La central despacha: aparece el botón; el mapa muestra la ambulancia, el trazado y "Llega en ≈ X min".
3. La ambulancia se mueve: el marcador avanza con animación.
4. Llega al lugar: "La ambulancia llegó al lugar", el mapa se cierra, el ciclo se detiene y en "Mis reportes" desaparece el botón.
5. Durante la atención y el traslado: no hay botón ni posición (el endpoint responde `ambulancia_en_el_lugar`).
6. Ambulancia sin GPS por más de 10 minutos: `ubicacion: null`, mensaje "Ubicación no disponible" sin marcador.
7. Con el id de un reporte de otra cuenta: `404`.
