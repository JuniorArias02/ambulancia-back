# API de geocodificación — guía para frontend

**Base URL (desarrollo):** `http://localhost:3000/api/v1`. Las reglas generales (encabezado `Authorization`, formato de error) son las de [`api-usuarios-roles-frontend.md`](api-usuarios-roles-frontend.md#1-reglas-generales).

Dos operaciones, para los formularios con mapa (emergencias, instituciones de salud):

| Operación | Endpoint | Para qué |
| --- | --- | --- |
| Dirección → coordenadas | `POST /geocodificacion` | El usuario **escribe** la dirección y se pone el marcador |
| Coordenadas → dirección | `POST /geocodificacion/inversa` | El usuario **toca el mapa** y se llena la dirección |

Roles: `administrador` y `despachador`. **La API key de Geoapify vive solo en el backend**: el frontend nunca llama a Geoapify directamente. Todo lo consultado **queda guardado en la base de datos**; si se repite la misma dirección o el mismo punto, la respuesta es inmediata y no consume la API.

---

## 1. Tocar el mapa → dirección: `POST /geocodificacion/inversa`

```json
{ "latitud": 4.685519, "longitud": -74.052851 }
```

`latitud` entre -90 y 90 y `longitud` entre -180 y 180, con un máximo de 7 decimales. Con Leaflet: `e.latlng.lat` y `e.latlng.lng`, redondeados con `Number(x.toFixed(7))`.

**200**
```json
{
  "id": "uuid",
  "puntoSolicitado": { "latitud": 4.685519, "longitud": -74.052851 },
  "direccion": "Cl 100 19 61, 111211 Bogotá, DC, Colombia",
  "lineaDireccion": "Cl 100 19 61",
  "componentes": {
    "calle": "Cl 100",
    "numero": "19 61",
    "barrio": null,
    "ciudad": "Bogotá",
    "departamento": "Distrito Especial",
    "codigoPostal": "111211",
    "pais": "co"
  },
  "precision": "exacta",
  "distanciaMetros": 0,
  "coordenadasDireccion": { "latitud": 4.685519, "longitud": -74.052851 },
  "proveedor": "geoapify",
  "origen": "proveedor",
  "geocodificadaEn": "2026-10-24T17:50:12.000Z"
}
```

### `precision`: qué tanto creerle (muéstrela siempre)

| `precision` | Significa | Qué hacer en el formulario | Ejemplo real |
| --- | --- | --- | --- |
| `exacta` | Hay placa y está a 25 m o menos del punto | Llenar **dirección** con `lineaDireccion` y **ciudad** con `componentes.ciudad` | "Cl 100 19 61", a 0 m |
| `aproximada` | Se conoce la calle cercana, pero la placa puede no ser exacta | Llenar igual, con el aviso **"Dirección aproximada (a 45 m), verifíquela"** | "Ak 68 53 36", a 45 m |
| `zona` | Solo se sabe el barrio o el municipio (típico en zona rural) | **No** llenar la dirección; poner `direccion` en **referencia del lugar** y pedir que escriban la dirección o la indicación | "Pie de Alto, Sibaté, Cundinamarca" (lo más cercano estaba a 957 m) |

- En `zona`, `lineaDireccion`, `calle`, `numero` y `coordenadasDireccion` vienen en `null`: el backend **no inventa** una dirección para el punto.
- `distanciaMetros`: distancia entre el punto tocado y la dirección encontrada.
- **Las coordenadas que se guardan en la emergencia son las del punto tocado** (`puntoSolicitado`), no `coordenadasDireccion`: el usuario marcó dónde está el paciente.

### Errores

| Código | Cuándo | Qué hacer |
| --- | --- | --- |
| `400` | Latitud o longitud fuera de rango | No debería pasar si vienen del mapa |
| `422` | "No se encontró una dirección para ese punto…" (por ejemplo, fuera de Colombia o en el mar) o "Las coordenadas no son válidas" | Dejar el marcador y pedir que escriban la dirección a mano |
| `429` | Más de 60 consultas por minuto | Consultar solo al **soltar** el marcador o al hacer clic, nunca mientras se arrastra |
| `503` | Proveedor caído o sin configurar | Dejar el marcador y pedir que escriban la dirección |

---

## 2. Escribir la dirección → coordenadas: `POST /geocodificacion`

```json
{ "direccion": "Calle 100 # 19-61", "ciudad": "Bogotá" }
```

| Campo | Regla |
| --- | --- |
| `direccion` | Obligatoria, de 3 a 200 caracteres. Acepta las formas comunes: `Cl 100 # 19-61`, `Calle 100 No. 19-61`, `CALLE 100 #19-61` |
| `ciudad` | Opcional, máximo 80, pero **envíela siempre**: sin ciudad, el backend usa la ciudad predeterminada si está configurada; si no, responde `422` |

**200**
```json
{
  "id": "uuid",
  "direccionOriginal": "Calle 100 # 19-61",
  "direccionNormalizada": "co|bogota|calle 100 19 61",
  "ciudad": "Bogotá",
  "direccionFormateada": "Cl 100 19 61, 111211 Bogotá, DC, Colombia",
  "coordenadas": { "latitud": 4.685519, "longitud": -74.052851 },
  "proveedor": "geoapify",
  "proveedorResultadoId": "51b4…",
  "confianza": 1,
  "origen": "proveedor",
  "geocodificadaEn": "2026-10-24T15:36:52.000Z"
}
```

- `origen`: `almacenada` (reutilizada, respuesta inmediata) o `proveedor` (se consultó a Geoapify, 1 a 3 s).
- El backend **verifica que el resultado sea la misma dirección** (vía, número, cruce y placa). Si el proveedor solo tiene algo parecido (por ejemplo, "Calle 100 **Sur**"), responde `422` en vez de dar un sitio equivocado.

| Código | Cuándo | Qué hacer |
| --- | --- | --- |
| `400` | Dirección muy corta o muy larga | Mostrar el mensaje |
| `422` | "No se encontró una ubicación confiable…" o "Indique la ciudad…" | **Pedir que toquen el punto en el mapa**. Es normal: muchas placas de Colombia no están en el mapa del proveedor |
| `429` | Más de 30 consultas por minuto | Geocodificar con un botón **Ubicar** o al salir del campo, nunca en cada tecla |
| `503` | Proveedor caído o sin configurar | Pedir que toquen el punto en el mapa |

---

## 3. Flujo recomendado en el formulario de emergencia

```text
          ┌──────────── escribe dirección + ciudad ──── [Ubicar] ───► POST /geocodificacion
          │                                                            200 → mover el marcador a `coordenadas`
          │                                                            422/503 → "toque el punto en el mapa"
Formulario┤
          │                                                            POST /geocodificacion/inversa
          └──────────── toca el mapa / suelta el marcador ──────────► 200 → llenar según `precision`
                                                                       422/503 → "escriba la dirección"
```

1. Las dos vías llevan al mismo estado: **marcador puesto + dirección escrita**. El usuario puede corregir cualquiera de los dos antes de guardar.
2. **No encadenar**: si la dirección vino de `/inversa`, no llamar luego a `/geocodificacion` con ese texto, porque el marcador ya está donde el usuario lo puso. Y si el marcador vino de `/geocodificacion`, no llamar a `/inversa`.
3. Cuando el usuario **edita a mano** el campo dirección después de un `/inversa`, se respeta su texto: no se vuelve a llenar solo.
4. Al guardar (`POST /emergencias`) se envían `direccion`, `referenciaLugar`, `latitud` y `longitud` tal como quedaron en el formulario.
5. Mostrar un indicador de carga en la primera consulta (`origen: "proveedor"`, 1 a 3 s).

Ejemplo con React + Leaflet (ilustrativo):

```tsx
function MapaUbicacion({ onUbicar }: { onUbicar: (r: GeocodificacionInversa | null, punto: Punto) => void }) {
  useMapEvents({
    async click(e) {
      const punto = { latitud: Number(e.latlng.lat.toFixed(7)), longitud: Number(e.latlng.lng.toFixed(7)) };
      try {
        const { data } = await api.post<GeocodificacionInversa>('/geocodificacion/inversa', punto);
        onUbicar(data, punto);
      } catch {
        onUbicar(null, punto); // 422 / 503: marcador puesto, dirección a mano
      }
    },
  });
  return null;
}

function aplicarAlFormulario(r: GeocodificacionInversa | null, punto: Punto, form: UseFormReturn<FormEmergencia>) {
  form.setValue('latitud', punto.latitud);
  form.setValue('longitud', punto.longitud);
  if (!r) return;
  if (r.precision === 'zona') {
    form.setValue('referenciaLugar', r.direccion);
  } else if (!form.getFieldState('direccion').isDirty) {
    form.setValue('direccion', r.lineaDireccion ?? r.direccion);
  }
}
```

---

## 4. Tipos TypeScript

```ts
export interface Punto {
  latitud: number;
  longitud: number;
}

export type PrecisionUbicacion = 'exacta' | 'aproximada' | 'zona';

export interface GeocodificacionInversa {
  id: string;
  puntoSolicitado: Punto;
  direccion: string;
  lineaDireccion: string | null;
  componentes: {
    calle: string | null;
    numero: string | null;
    barrio: string | null;
    ciudad: string | null;
    departamento: string | null;
    codigoPostal: string | null;
    pais: string | null;
  };
  precision: PrecisionUbicacion;
  distanciaMetros: number;
  coordenadasDireccion: Punto | null;
  proveedor: string;
  origen: 'almacenada' | 'proveedor';
  geocodificadaEn: string;
}

export interface DireccionGeocodificada {
  id: string;
  direccionOriginal: string;
  direccionNormalizada: string;
  ciudad: string | null;
  direccionFormateada: string | null;
  coordenadas: Punto;
  proveedor: string;
  proveedorResultadoId: string | null;
  confianza: number | null;
  origen: 'almacenada' | 'proveedor';
  geocodificadaEn: string;
}
```
