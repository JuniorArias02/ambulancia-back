# Rutas de las ambulancias — guía para frontend web y app móvil

**Base URL (desarrollo):** `http://localhost:3000/api/v1`. Las reglas generales (encabezado `Authorization`, formato de error, `401`) son las de [`api-usuarios-roles-frontend.md`](api-usuarios-roles-frontend.md#1-reglas-generales).

**La ruta la calcula el backend; el frontend solo la dibuja.** No llame a Geoapify, Google ni OSRM desde el navegador ni desde la app para trazar la ruta de una ambulancia.

---

## 1. Qué es "la ruta de una ambulancia"

- Es el camino **por calles** desde donde estaba la ambulancia hasta la **emergencia** que atiende, con su distancia y su tiempo estimado.
- Solo existe mientras el servicio está **`asignada`** o **`en_camino`**. Una ambulancia libre no tiene ruta, y al llegar a la escena (`en_escena`) la ruta deja de mostrarse.
- El tramo escena → hospital llegará cuando el traslado tenga un hospital de destino.

### Cuándo se calcula (todo lo hace el backend solo)

| Momento | Qué pasa |
| --- | --- |
| Al despachar | Se calcula desde la última posición GPS de la ambulancia, **si es de los últimos 10 minutos** |
| Sin GPS reciente al despachar | No se inventa: se espera al primer reporte GPS y en ese momento se calcula |
| Cada reporte GPS sobre la ruta | **No** se recalcula (no se gasta cuota) |
| La ambulancia se sale de la ruta (más de 150 m) | Se recalcula desde donde está, como máximo una vez por minuto |

Cada vez que hay una ruta nueva, llega el evento de tiempo real `asignacion.ruta_actualizada` (sección 4).

---

## 2. Objeto `Ruta`

```json
{
  "asignacionId": "uuid",
  "ambulanciaId": "uuid",
  "ambulanciaCodigo": "AMB-02",
  "emergenciaId": "uuid",
  "numeroEmergencia": "EMG-20261024-0007",
  "tramo": "hacia_emergencia",
  "motivo": "despacho",
  "origen": { "latitud": 7.8939, "longitud": -72.5078 },
  "destino": { "latitud": 7.907, "longitud": -72.497 },
  "geometria": {
    "type": "LineString",
    "coordinates": [[-72.507726, 7.893516], [-72.507272, 7.893602], "…", [-72.497, 7.907]]
  },
  "distanciaMetros": 2532,
  "duracionSegundos": 229,
  "llegadaEstimada": "2026-10-24T23:55:32.756Z",
  "proveedor": "geoapify",
  "calculadaEn": "2026-10-24T23:51:43.756Z"
}
```

| Campo | Para qué |
| --- | --- |
| `geometria` | **GeoJSON `LineString`**: se dibuja directo (ver sección 5). ⚠️ Cada par es **`[longitud, latitud]`** (orden GeoJSON), al revés de como lo usa Leaflet en `L.polyline` |
| `distanciaMetros` | Mostrar "2.5 km" |
| `duracionSegundos` | Mostrar "4 min" |
| `llegadaEstimada` | Mostrar "Llega ≈ 18:55" (hora local). Es `calculadaEn` + la duración; **no** se actualiza con el tráfico ni con el avance |
| `motivo` | `despacho`, `sin_ruta` (se calculó con el primer GPS) o `desvio` (se recalculó por desvío) |
| `origen` | Dónde estaba la ambulancia al calcular |
| `destino` | La emergencia |
| `ambulanciaId` | Para asociar la línea con el marcador de la ambulancia |

> **ETA sin tráfico:** el tiempo lo estima Geoapify con velocidades típicas de cada vía, sin tráfico en vivo. Muéstrelo como **aproximado** ("≈ 4 min").

---

## 3. Endpoints

### Todas las rutas activas (mapa del despacho) — `GET /rutas/activas`

Roles: `administrador`, `despachador`.

**200**: `Ruta[]`, una por cada ambulancia que va hacia una emergencia. Las que todavía no tienen ruta (sin GPS reciente) no aparecen. Lista vacía = ninguna ambulancia en camino.

### La ruta de un servicio — `GET /asignaciones/{id}/ruta`

Roles: `administrador` y `despachador` (cualquier servicio); `conductor` y `paramedico` (**solo el de su turno**).

| Código | Cuándo | Qué hacer |
| --- | --- | --- |
| `200` | Hay ruta | Dibujarla |
| `403` | Un tripulante pide la ruta de otro servicio | No debería pasar si usa el `asignacion.id` de `GET /mi-servicio` |
| `404` "Ruta del servicio no encontrado" | Aún no se pudo calcular: sin GPS reciente o emergencia sin coordenadas | No dibujar línea; mostrar "Calculando ruta…" y esperar el evento de la sección 4 |
| `404` "Asignación no encontrado" | El id no existe | — |

---

## 4. Tiempo real — evento `asignacion.ruta_actualizada`

Llega a la **central** (administrador y despachador) y a la **tripulación de ese servicio** cada vez que se calcula una ruta nueva (despacho, primer GPS o desvío).

```json
{
  "id": "uuid-del-evento",
  "tipo": "asignacion.ruta_actualizada",
  "ocurridoEn": "2026-10-24T23:52:52.097Z",
  "datos": { "ruta": { "…": "el mismo objeto Ruta de la sección 2" } }
}
```

**Qué hacer:** reemplazar la línea de esa ambulancia (clave: `datos.ruta.asignacionId`) por la nueva. Descarte eventos repetidos por `id`.

**Cuándo quitar la línea:** al recibir `asignacion.actualizada` con un `estado` distinto de `asignada` o `en_camino` (llegó a la escena, finalizó o se canceló).

**Al conectar o reconectar el socket:** vuelva a pedir `GET /rutas/activas` (web) o `GET /asignaciones/{id}/ruta` (app).

**Sin WebSocket:** consulte `GET /rutas/activas` cada **30 s** con el mapa visible. Las rutas cambian poco; no hace falta más.

---

## 5. Cómo dibujarla

### Web (react-leaflet)

```tsx
import { GeoJSON } from 'react-leaflet';

function RutasActivas({ rutas }: { rutas: Ruta[] }) {
  return (
    <>
      {rutas.map((ruta) => (
        <GeoJSON
          key={`${ruta.asignacionId}-${ruta.calculadaEn}`} // nueva key = se redibuja al recalcular
          data={ruta.geometria}
          style={{ color: '#2563eb', weight: 5, opacity: 0.8 }}
        />
      ))}
    </>
  );
}
```

`<GeoJSON>` entiende el orden `[longitud, latitud]` sin convertir nada. Si prefiere `<Polyline>`, invierta cada par: `ruta.geometria.coordinates.map(([lon, lat]) => [lat, lon])`.

Sugerencias:
- Un color por estado: `asignada` en gris punteado, `en_camino` en azul continuo.
- *Tooltip* sobre la línea: "AMB-02 → EMG-20261024-0007 · 2.5 km · ≈ 4 min · llega 18:55".
- El marcador de la ambulancia se sigue moviendo con `ambulancia.ubicacion_actualizada` ([`api-mapa-ambulancias-frontend.md`](api-mapa-ambulancias-frontend.md)). La línea no se recorta sola a medida que avanza; si quiere ese efecto, hágalo en el cliente (es solo visual).

### App móvil (Flutter, `flutter_map`)

```dart
final puntos = (ruta['geometria']['coordinates'] as List)
    .map((par) => LatLng((par[1] as num).toDouble(), (par[0] as num).toDouble())) // [lon, lat] → LatLng(lat, lon)
    .toList();

PolylineLayer(polylines: [
  Polyline(points: puntos, strokeWidth: 5, color: Colors.blue),
]);
```

- Pida la ruta con `GET /asignaciones/{asignacion.id}/ruta`, usando el `asignacion.id` de `GET /mi-servicio`.
- **Para navegar giro a giro, abra Google Maps o Waze** con el destino (`emergencia.coordenadas`). La ruta del backend es para **mostrar y estimar**; los navegadores reaccionan al instante a cada giro y al tráfico.

---

## 6. Tipos

```ts
export interface Ruta {
  asignacionId: string;
  ambulanciaId: string;
  ambulanciaCodigo: string | null;
  emergenciaId: string;
  numeroEmergencia: string | null;
  tramo: 'hacia_emergencia';
  motivo: 'despacho' | 'sin_ruta' | 'desvio';
  origen: { latitud: number; longitud: number };
  destino: { latitud: number; longitud: number };
  geometria: { type: 'LineString'; coordinates: [number, number][] }; // [longitud, latitud]
  distanciaMetros: number;
  duracionSegundos: number;
  llegadaEstimada: string;
  proveedor: string;
  calculadaEn: string;
}
```

---

## 7. Resumen

| Necesidad | Endpoint o evento |
| --- | --- |
| Rutas de todas las ambulancias en camino (web) | `GET /rutas/activas` |
| Ruta de un servicio (web o app) | `GET /asignaciones/{id}/ruta` |
| Ruta nueva (despacho, primer GPS, desvío) | Evento `asignacion.ruta_actualizada` |
| Quitar la línea | `asignacion.actualizada` con estado ≠ `asignada` / `en_camino` |
| Navegación giro a giro (app) | Abrir Google Maps o Waze con `emergencia.coordenadas` |
