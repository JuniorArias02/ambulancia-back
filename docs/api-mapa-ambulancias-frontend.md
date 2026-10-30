# Mapa de ambulancias (web) — guía para frontend

**Base URL (desarrollo):** `http://localhost:3000/api/v1`. Las reglas generales (encabezado `Authorization`, formato de error, `401`) son las de [`api-usuarios-roles-frontend.md`](api-usuarios-roles-frontend.md#1-reglas-generales).

**Para qué:** mostrar en el mapa del centro de despacho dónde está cada ambulancia, en qué estado está y cuáles están libres para despachar. **No hace falta ningún endpoint nuevo**: todo sale de endpoints que ya existen.

**Roles:** `administrador` y `despachador`. Con otro rol, los endpoints responden `403`.

---

## 1. Posiciones de todas las ambulancias — `GET /ambulancias`

```http
GET /api/v1/ambulancias?limite=100
Authorization: Bearer <tokenAcceso>
```

Use `limite=100` (el máximo) para traer toda la flota en una sola llamada. Si `total` llega a ser mayor que 100, pida también `pagina=2`.

**200**
```json
{
  "datos": [
    {
      "id": "dd44d7a4-b66f-4e72-8316-d2c65922c945",
      "codigo": "AMB-01",
      "placa": "ABC123",
      "tipo": { "id": "uuid", "nombre": "TAM", "descripcion": "Transporte Asistencial Medicalizado" },
      "estadoOperativo": "en_servicio",
      "ultimaUbicacion": {
        "latitud": 4.685,
        "longitud": -74.068,
        "registradaEn": "2026-10-24T14:35:26.176Z"
      },
      "creadaEn": "2026-10-24T14:20:00.000Z"
    }
  ],
  "total": 1,
  "pagina": 1,
  "limite": 100
}
```

- **`ultimaUbicacion`** es la última posición que envió el celular de la tripulación. Viene en **`null`** si la ambulancia nunca ha reportado GPS: **no la pinte en el mapa**, pero muéstrela en la lista lateral como "sin ubicación".
- Las ambulancias vienen ordenadas por código.

### Antigüedad de la posición

Una posición vieja puede engañar al despachador: puede creer que la ambulancia está cerca cuando ya se movió o perdió señal.

| Antigüedad de `registradaEn` | Cómo pintarla |
| --- | --- |
| Menos de 2 minutos | Normal, con el color del estado |
| De 2 a 10 minutos | Marcador semitransparente + "hace X min" en el *tooltip* |
| Más de 10 minutos | Marcador **gris**: "Sin señal desde las HH:MM" |

Calcule la antigüedad con la hora local del navegador (`Date.now() - new Date(registradaEn).getTime()`) y refresque las etiquetas cada 30 s, aunque no lleguen datos nuevos.

---

## 2. Filtrar: libres y asignadas

El campo **`estadoOperativo`** indica si la ambulancia tiene una emergencia:

| `estadoOperativo` | ¿Tiene emergencia? | ¿Se puede despachar? | Color sugerido |
| --- | --- | --- | --- |
| `disponible` | No | ✅ Sí (tiene tripulación en turno) | Verde |
| `en_servicio` | **Sí** | No | Azul |
| `fuera_servicio` | No | No (sin tripulación o fuera de turno) | Gris |
| `mantenimiento` | No | No | Naranja |

**"Las que no están asignadas a una emergencia"** son todas las que no están `en_servicio`. **Las que se pueden enviar ya** son solo las `disponible`.

### Opción recomendada: filtrar en el navegador

Traiga **todas** una vez y filtre con chips en el mapa:

```text
[ Todas (12) ]  [ Disponibles (5) ]  [ En servicio (4) ]  [ Fuera de servicio / mantenimiento (3) ]
```

Así, cambiar de filtro es instantáneo y los contadores siempre cuadran.

### Opción alternativa: filtrar en el servidor

```http
GET /api/v1/ambulancias?estadoOperativo=disponible&limite=100
```

Otros filtros disponibles: `tipoAmbulanciaId` (TAB o TAM, con el `id` de `GET /tipos-ambulancia`) y `busqueda` (código o placa).

---

## 3. ¿A qué emergencia va cada ambulancia en servicio? — `GET /asignaciones?soloActivas=true`

```http
GET /api/v1/asignaciones?soloActivas=true&limite=100
```

Cada asignación activa trae `ambulanciaId`, `ambulanciaCodigo`, `emergenciaId`, `numeroEmergencia` y `estado` (`asignada`, `en_camino`, `en_escena` o `trasladando`). Detalle completo en [`api-despacho-frontend.md`](api-despacho-frontend.md) §4.

Arme un mapa `ambulanciaId → asignación` para:
- mostrar en el *tooltip* del marcador azul: **"AMB-01 → EMG-20261024-0004 · En camino"**;
- trazar opcionalmente una línea punteada entre la ambulancia y su emergencia (coordenadas de `GET /emergencias?soloActivas=true`).

**Recorrido de un servicio:** `GET /ubicaciones?asignacionId={id}` devuelve los puntos en orden cronológico, listos para dibujar la línea recorrida ([`api-despacho-frontend.md`](api-despacho-frontend.md) §5).

**Ruta por calles hasta la emergencia:** `GET /rutas/activas` devuelve la ruta de cada ambulancia en camino, ya calculada por el backend (GeoJSON, distancia y llegada estimada). Ver [`api-rutas-frontend.md`](api-rutas-frontend.md).

---

## 4. Que el mapa se actualice solo (tiempo real)

Conexión, autenticación y reconexión: [`api-tiempo-real-frontend.md`](api-tiempo-real-frontend.md). El usuario de la central recibe estos eventos:

| Evento | `datos` | Qué hacer en el mapa |
| --- | --- | --- |
| `ambulancia.ubicacion_actualizada` | `{ ambulanciaId, asignacionId, latitud, longitud, velocidad, registradaEn }` | **Mover solo ese marcador.** Llega como máximo una vez cada 3 s por ambulancia |
| `ambulancia.actualizada` | `{ ambulancia: <la misma forma de GET /ambulancias> }` | Reemplazar esa ambulancia: cambia el color y el filtro en el que aparece (por ejemplo, al despacharla pasa de verde a azul) |
| `asignacion.creada` / `asignacion.actualizada` | `{ asignacion }` | Actualizar el mapa `ambulanciaId → asignación` (y el *tooltip*). Si quedó `finalizada` o `cancelada`, quitarla |

Todos los eventos llegan dentro del sobre `{ id, tipo, ocurridoEn, datos }`:
- Descarte los repetidos por `id`.
- Para la ubicación, ignore un evento cuyo `registradaEn` sea **más viejo** que el que ya tiene ese marcador. Los celulares que recuperan señal envían posiciones atrasadas.

**Al conectar o reconectar** (evento `conectado`), vuelva a pedir `GET /ambulancias` y `GET /asignaciones?soloActivas=true`: el servidor no reenvía lo que se perdió mientras estaba desconectado.

**Sin tiempo real** (servidor de WebSocket apagado o mientras no lo integran): consulte `GET /ambulancias` cada **10–15 segundos** solo con el mapa visible. Detenga la consulta cuando la pestaña no esté visible (`document.visibilityState`).

---

## 5. Ejemplo (React 19 + React Query + react-leaflet)

Ilustrativo: adapte nombres y estructura al proyecto.

```tsx
// api/ambulancias.ts
export const claveAmbulancias = ['ambulancias', 'mapa'] as const;

export function useAmbulanciasMapa(tiempoRealActivo: boolean) {
  return useQuery({
    queryKey: claveAmbulancias,
    queryFn: async () =>
      (await api.get<Paginado<Ambulancia>>('/ambulancias', { params: { limite: 100 } })).data.datos,
    // Si no hay WebSocket, se refresca cada 15 s; con WebSocket, los eventos lo mantienen al día.
    refetchInterval: tiempoRealActivo ? false : 15_000,
    refetchIntervalInBackground: false,
  });
}

// Al recibir `ambulancia.ubicacion_actualizada`
export function aplicarUbicacion(queryClient: QueryClient, e: EventoTiempoReal<UbicacionEvento>) {
  queryClient.setQueryData<Ambulancia[]>(claveAmbulancias, (actuales) =>
    actuales?.map((a) => {
      if (a.id !== e.datos.ambulanciaId) return a;
      const previa = a.ultimaUbicacion?.registradaEn;
      if (previa && new Date(previa) >= new Date(e.datos.registradaEn)) return a; // llegó atrasada
      return {
        ...a,
        ultimaUbicacion: {
          latitud: e.datos.latitud,
          longitud: e.datos.longitud,
          registradaEn: e.datos.registradaEn,
        },
      };
    }),
  );
}

// Al recibir `ambulancia.actualizada`
export function aplicarAmbulancia(queryClient: QueryClient, e: EventoTiempoReal<{ ambulancia: Ambulancia }>) {
  queryClient.setQueryData<Ambulancia[]>(claveAmbulancias, (actuales) =>
    actuales?.map((a) => (a.id === e.datos.ambulancia.id ? e.datos.ambulancia : a)),
  );
}

// Componente
type Filtro = 'todas' | 'disponible' | 'en_servicio' | 'otras';

function MapaAmbulancias() {
  const { data: ambulancias = [] } = useAmbulanciasMapa(conectado);
  const [filtro, setFiltro] = useState<Filtro>('todas');

  const visibles = ambulancias.filter((a) => {
    if (!a.ultimaUbicacion) return false;
    if (filtro === 'todas') return true;
    if (filtro === 'otras') return a.estadoOperativo === 'fuera_servicio' || a.estadoOperativo === 'mantenimiento';
    return a.estadoOperativo === filtro;
  });

  return (
    <MapContainer center={[4.65, -74.08]} zoom={12}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {visibles.map((a) => (
        <Marker
          key={a.id}
          position={[a.ultimaUbicacion!.latitud, a.ultimaUbicacion!.longitud]}
          icon={iconoAmbulancia(a.estadoOperativo, minutosDesde(a.ultimaUbicacion!.registradaEn))}
        >
          <Tooltip>{a.codigo} · {etiquetaEstado[a.estadoOperativo]}</Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
```

---

## 6. Tipos TypeScript

```ts
export type EstadoOperativo = 'disponible' | 'en_servicio' | 'fuera_servicio' | 'mantenimiento';

export interface Ambulancia {
  id: string;
  codigo: string;
  placa: string;
  tipo: { id: string; nombre: string; descripcion: string | null };
  estadoOperativo: EstadoOperativo;
  ultimaUbicacion: { latitud: number; longitud: number; registradaEn: string } | null;
  creadaEn: string;
}

export interface UbicacionEvento {
  ambulanciaId: string;
  asignacionId: string | null;
  latitud: number;
  longitud: number;
  velocidad: number | null;
  registradaEn: string;
}

export const etiquetaEstado: Record<EstadoOperativo, string> = {
  disponible: 'Disponible',
  en_servicio: 'En servicio',
  fuera_servicio: 'Fuera de servicio',
  mantenimiento: 'En mantenimiento',
};
```

---

## 7. Resumen

| Necesidad | Endpoint o evento |
| --- | --- |
| Posición y estado de todas las ambulancias | `GET /ambulancias?limite=100` |
| Solo las libres para despachar | `estadoOperativo === 'disponible'` (en el navegador) o `GET /ambulancias?estadoOperativo=disponible` |
| A qué emergencia va cada una | `GET /asignaciones?soloActivas=true` |
| Recorrido de un servicio | `GET /ubicaciones?asignacionId={id}` |
| Ruta por calles de cada ambulancia en camino | `GET /rutas/activas` + evento `asignacion.ruta_actualizada` |
| Mover los marcadores en vivo | Evento `ambulancia.ubicacion_actualizada` |
| Cambio de estado (color y filtro) | Evento `ambulancia.actualizada` |
| Sin WebSocket | Volver a consultar `GET /ambulancias` cada 10–15 s con el mapa visible |
