# Ciclo de atención — guía para el frontend web (mapa y despacho)

**Para:** el equipo del frontend web (centro de despacho).
**Complementa a:** [`api-despacho-frontend.md`](api-despacho-frontend.md) §4 (asignaciones), [`api-mapa-ambulancias-frontend.md`](api-mapa-ambulancias-frontend.md) y [`api-tiempo-real-frontend.md`](api-tiempo-real-frontend.md).

**Objetivo:** que el mapa y los paneles muestren en todo momento en qué etapa va cada ambulancia, en especial **cuando ya recogió al paciente**, sin recargar la página.

---

## 1. Las etapas y cómo se ven

```text
asignada → en_camino → en_escena → atendiendo → trasladando → finalizada
                         llegó       atendiendo    PACIENTE A BORDO
                                                   (ya lo recogió)
```

| `asignacion.estado` | Texto | Ambulancia en el mapa | Emergencia en el mapa | Ruta |
| --- | --- | --- | --- | --- |
| `asignada` | Asignada | Azul claro | Marcador normal (prioridad) | Se dibuja |
| `en_camino` | En camino | Azul, en movimiento | Normal | Se dibuja |
| `en_escena` | En la escena | Azul sobre la emergencia | Con halo "ambulancia en el lugar" | Ya no |
| `atendiendo` | Atendiendo al paciente | Igual | Halo + "en atención" | No |
| **`trasladando`** | **Paciente a bordo** | **Ícono distinto (por ejemplo, con cruz o camilla) y color destacado** | **Se atenúa o se oculta**: ya no hay paciente en el sitio (ver la regla abajo) | No |
| `finalizada` | Finalizada | Vuelve a verde (disponible) | Si se cerró, sale del mapa de activas | No |
| `cancelada` | Cancelada | Vuelve a verde | Vuelve a "recibida" si era la única | No |

**Regla para la emergencia cuando "ya lo recogieron":** atenúe u oculte el marcador de la emergencia cuando **todas** sus asignaciones activas están en `trasladando`. Si otra ambulancia sigue en camino o en la escena (varias víctimas), el marcador se mantiene.

> El estado de la **emergencia** no cambia al recoger al paciente: sigue `en_atencion` hasta que termina su último servicio (`cerrada`). La etapa fina la da la **asignación**.

---

## 2. Cómo enterarse en tiempo real

Todo llega por el evento que ya escuchan, **`asignacion.actualizada`** (`datos.asignacion`, la misma forma de `GET /asignaciones/{id}`):

| Evento | Qué hacer |
| --- | --- |
| `asignacion.actualizada` con `estado: "trasladando"` | **Paciente a bordo**: cambiar el ícono de la ambulancia, atenuar u ocultar la emergencia (según la regla) y opcionalmente mostrar un aviso: "AMB-02 recogió al paciente de EMG-20261025-0001 · 15:02" |
| `asignacion.actualizada` con `estado: "en_escena"` | "AMB-02 llegó a la escena". Quitar la ruta |
| `asignacion.actualizada` con `estado: "atendiendo"` | "Atendiendo al paciente" |
| `asignacion.actualizada` con `estado: "finalizada"` | Quitar la asignación de "servicios en curso" |
| `ambulancia.actualizada` | Cambia el estado operativo (al finalizar vuelve a `disponible`) |
| `emergencia.actualizada` con `cambios: ["estado"]` | La emergencia pasó a `en_atencion` (llegada) o a `cerrada` (último servicio terminado) |
| `ambulancia.ubicacion_actualizada` | Mover el marcador (también durante el traslado) |

Recuerde: descartar los eventos repetidos por `id` y, al reconectar, volver a pedir `GET /asignaciones?soloActivas=true`.

**Sin WebSocket:** consulte `GET /asignaciones?soloActivas=true` cada 10–15 s con el mapa visible.

---

## 3. Línea de tiempo del servicio — `GET /asignaciones/{id}/eventos`

Para el detalle de un servicio o de la emergencia: cada paso con su **hora, responsable y rol**, en orden.

```json
[
  { "estadoAnterior": null, "estadoNuevo": "asignada", "ocurridoEn": "2026-10-25T14:45:17.000Z",
    "responsable": { "id": "uuid", "nombreCompleto": "Laura Gómez", "rol": "despachador" },
    "posicion": null, "precisionMetros": null, "distanciaEscenaMetros": null, "fueraDeRadio": false, "observacion": null },
  { "estadoAnterior": "en_camino", "estadoNuevo": "en_escena", "ocurridoEn": "2026-10-25T14:58:02.000Z",
    "responsable": { "id": "uuid", "nombreCompleto": "Carlos Pérez", "rol": "conductor" },
    "posicion": { "latitud": 7.90745, "longitud": -72.497 }, "precisionMetros": 6, "distanciaEscenaMetros": 50, "fueraDeRadio": false, "observacion": null },
  { "estadoAnterior": "atendiendo", "estadoNuevo": "trasladando", "ocurridoEn": "2026-10-25T15:02:40.000Z",
    "responsable": { "id": "uuid", "nombreCompleto": "Lucía Rojas", "rol": "paramedico" }, "…": "…" }
]
```

Sugerencia de vista:

```text
14:45  Despachada            por Laura Gómez (despachador)
14:46  En camino             por Carlos Pérez (conductor)
14:58  Llegó a la escena     por Carlos Pérez (conductor) · a 50 m
15:00  Atendiendo al paciente  por Lucía Rojas (paramédico)
15:02  Paciente a bordo      por Lucía Rojas (paramédico)
15:20  Paciente entregado    por Carlos Pérez (conductor)
```

- **Llegada fuera de radio** (`fueraDeRadio: true`): resáltela con un ícono de advertencia y muestre `observacion` (el motivo que dio el conductor). La central decide si investigar.
- **Cierre sin traslado**: el evento `finalizada` trae `observacion` con el motivo (atendido en el sitio, rechazo del traslado…).
- **Cancelación**: el evento `cancelada` trae el motivo en `observacion`.
- Para refrescar la línea de tiempo abierta, vuelva a pedirla al recibir `asignacion.actualizada` de ese servicio.

Los tiempos de respuesta salen restando fechas: llegada − despacho, traslado − llegada, etc.

---

## 4. Cambios para el panel del despachador

1. **Estado nuevo `atendiendo`** en tipos, textos, colores y filtros.
2. **"Llegó a la escena" ya no lo puede marcar el despachador**: solo el conductor desde la app, con GPS. Si el panel tenía ese botón, quítelo; el backend responde `403`. El despachador sí puede marcar los demás pasos (por ejemplo, si le avisan por radio), pero **cerrar sin traslado exige `observacion`**.
3. Ya no existe el paso directo `en_escena → trasladando`: ahora es `en_escena → atendiendo → trasladando`. Use siempre `asignacion.siguientesEstados` para pintar los botones.
4. **Campo nuevo** en `Asignacion`: `atencionInicioEn` (fecha o `null`).
5. Repetir un paso ya hecho responde `200` sin duplicar: los reintentos son seguros.

### Cuerpo de `PATCH /asignaciones/{id}/avance` (para lo que marque la central)

```json
{ "estado": "finalizada", "observacion": "Sin paciente en el lugar" }
```

`observacion` es obligatoria al finalizar desde `en_escena` o `atendiendo`. Entre 5 y 255 caracteres.

---

## 5. Tipos TypeScript (cambios)

```ts
export type EstadoAsignacion =
  | 'asignada' | 'en_camino' | 'en_escena' | 'atendiendo' | 'trasladando' | 'finalizada' | 'cancelada';

export interface Asignacion {
  // …campos existentes…
  atencionInicioEn: string | null; // nuevo
}

export interface EventoAsignacion {
  id: string;
  estadoAnterior: EstadoAsignacion | null;
  estadoNuevo: EstadoAsignacion;
  ocurridoEn: string;
  responsable: { id: string; nombreCompleto: string | null; rol: string | null } | null;
  posicion: { latitud: number; longitud: number } | null;
  precisionMetros: number | null;
  distanciaEscenaMetros: number | null;
  fueraDeRadio: boolean;
  observacion: string | null;
}

export const etiquetaEstadoAsignacion: Record<EstadoAsignacion, string> = {
  asignada: 'Asignada',
  en_camino: 'En camino',
  en_escena: 'En la escena',
  atendiendo: 'Atendiendo al paciente',
  trasladando: 'Paciente a bordo',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
};

/** ¿Ya recogieron a todos los pacientes de esta emergencia? */
export function pacienteRecogido(asignacionesActivasDeLaEmergencia: Asignacion[]): boolean {
  return (
    asignacionesActivasDeLaEmergencia.length > 0 &&
    asignacionesActivasDeLaEmergencia.every((a) => a.estado === 'trasladando')
  );
}
```

---

## 6. Resumen

| Necesidad | Cómo |
| --- | --- |
| Saber que la ambulancia recogió al paciente | Evento `asignacion.actualizada` con `estado: "trasladando"` |
| Atenuar u ocultar la emergencia | Cuando **todas** sus asignaciones activas están en `trasladando` |
| Detalle con horas y responsables | `GET /asignaciones/{id}/eventos` |
| Ver si la llegada fue dudosa | Evento `en_escena` con `fueraDeRadio: true` + `observacion` |
| Botones del panel | `asignacion.siguientesEstados` (sin "en_escena": es del conductor) |
