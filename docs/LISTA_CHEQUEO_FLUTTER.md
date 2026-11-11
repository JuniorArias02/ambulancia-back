# Lista de chequeo diaria del conductor: guía para Flutter

**Para:** el agente de Flutter (`ambulancia/app`).
**Estado:** implementado en el backend el 2026-11-10 y probado con peticiones HTTP reales. Está en Swagger (`/api/docs`, sección "Lista de chequeo: conductor").

---

## 1. Qué es

Cada día, el **conductor** revisa la ambulancia que eligió (aceite, luces, sirena…) y califica cada punto con una opción configurada por el administrador (por ejemplo, Bien, Regular o Estable). Si la pregunta lo permite, puede dejar una observación.

- Solo el rol `conductor`. El paramédico recibe `403`: no le muestre la opción.
- **Un chequeo por día y por ambulancia.** Si cambia de ambulancia, diligencia otro para la nueva.
- Se responde por partes (**borrador**) y se cierra con **Finalizar**. Ya finalizado, no se edita.
- **El conductor y la ambulancia los conoce el backend** por el token y la ambulancia seleccionada. **No los envíe.**

---

## 2. Endpoints

Prefijo `/api/v1`, con `Authorization: Bearer <tokenAcceso>`.

| Método | Ruta | Para qué |
| --- | --- | --- |
| GET | `/mi-chequeo-diario` | Abrir la pantalla: preguntas, opciones y lo ya respondido hoy |
| POST | `/mi-chequeo-diario` | Iniciar el chequeo de hoy (se puede repetir sin duplicar) |
| PUT | `/mi-chequeo-diario/respuestas` | Guardar una o varias respuestas |
| POST | `/mi-chequeo-diario/finalizar` | Cerrar el chequeo |
| GET | `/mi-chequeo-diario/historial?estado=&desde=&hasta=&pagina=&limite=` | Mis chequeos anteriores |
| GET | `/mi-chequeo-diario/historial/{id}` | Detalle de uno de mis chequeos |

---

## 3. `GET /mi-chequeo-diario`

```json
{
  "fecha": "2026-11-10",
  "ambulanciaId": "uuid",
  "lista": {
    "id": "uuid",
    "nombre": "Chequeo diario",
    "descripcion": "Antes del turno",
    "activa": true,
    "items": [
      { "id": "uuid-aceite", "pregunta": "¿Nivel de aceite?", "orden": 0, "obligatorio": true, "permiteObservacion": true, "activo": true },
      { "id": "uuid-luces", "pregunta": "¿Luces y sirena?", "orden": 1, "obligatorio": true, "permiteObservacion": false, "activo": true },
      { "id": "uuid-botiquin", "pregunta": "¿Botiquín completo?", "orden": 2, "obligatorio": false, "permiteObservacion": true, "activo": true }
    ],
    "estados": [
      { "id": "uuid-bien", "nombre": "Bien", "valor": 2, "orden": 0, "activo": true },
      { "id": "uuid-regular", "nombre": "Regular", "valor": 1, "orden": 1, "activo": true },
      { "id": "uuid-estable", "nombre": "Estable", "valor": 0, "orden": 2, "activo": true }
    ],
    "creadaEn": "…",
    "actualizadaEn": "…"
  },
  "chequeo": null
}
```

- `lista.items` y `lista.estados` ya vienen **solo activos y en orden**.
- `chequeo: null` → aún no lo inicia hoy. Si ya lo inició, trae el chequeo (sección 5), con `estado` y las respuestas guardadas: **precargue el formulario** con ellas.

| Error | Qué hacer |
| --- | --- |
| `422` "Seleccione su ambulancia…" | Llevar a la selección de ambulancia (`/mi-ambulancia`) |
| `404` "Lista de chequeo activa no encontrado" | "El administrador no ha configurado la lista de chequeo"; sin formulario |
| `403` | No es conductor de esa ambulancia: no mostrar la opción |

---

## 4. Iniciar: `POST /mi-chequeo-diario`

Sin cuerpo. Responde **`201`** si lo crea o **`200`** si ya existía (`creado: false`), con la forma de la sección 3 más `"creado"` y el `chequeo` ya lleno. Llámelo al tocar "Empezar chequeo"; repetirlo no duplica nada.

---

## 5. Responder: `PUT /mi-chequeo-diario/respuestas`

```json
{
  "respuestas": [
    { "itemId": "uuid-aceite", "estadoId": "uuid-regular", "tieneObservacion": true, "observacion": "Bajo, se rellenó" },
    { "itemId": "uuid-luces", "estadoId": "uuid-bien", "tieneObservacion": false }
  ]
}
```

| Campo | Regla |
| --- | --- |
| `itemId` | Una pregunta de `lista.items` |
| `estadoId` | Una opción de `lista.estados` (de la misma lista) |
| `tieneObservacion` | `true` exige `observacion` (máx. 1000). Solo si la pregunta tiene `permiteObservacion: true` |
| `observacion` | Con `tieneObservacion: false` se ignora |

- **Envíe por partes:** al elegir cada opción, o con un "Guardar" cada cierto tiempo. Responder otra vez una pregunta **reemplaza** su respuesta.
- No envíe `ambulanciaId`, `conductorId` ni ningún campo extra: `400`.

Respuesta `200`: el chequeo.

```json
{
  "id": "uuid",
  "fecha": "2026-11-10",
  "estado": "borrador",
  "iniciadoEn": "…",
  "finalizadoEn": null,
  "listaChequeoId": "uuid",
  "ambulanciaId": "uuid",
  "ambulanciaCodigo": "AMB-01",
  "conductorId": "uuid",
  "conductorNombre": "Pedro Díaz",
  "respuestas": [
    {
      "itemId": "uuid-aceite",
      "pregunta": "¿Nivel de aceite?",
      "estadoId": "uuid-regular",
      "calificacion": "Regular",
      "tieneObservacion": true,
      "observacion": "Bajo, se rellenó",
      "respondidoEn": "…"
    }
  ],
  "pendientes": ["uuid-luces"]
}
```

`pendientes` son las preguntas **obligatorias** sin responder: márquelas en el formulario y no habilite "Finalizar" hasta que la lista esté vacía.

| Error | Cuándo |
| --- | --- |
| `404` | No ha iniciado el chequeo de hoy: llame primero a `POST /mi-chequeo-diario` |
| `422` | Opción de otra lista, observación vacía, observación en una pregunta que no la admite, o chequeo ya finalizado. Muestre `mensaje` |
| `409` | Se finalizó desde otro dispositivo: recargue con `GET` |

---

## 6. Finalizar: `POST /mi-chequeo-diario/finalizar`

Sin cuerpo. `200` con el chequeo en `estado: "finalizado"`.

- `422` "Faltan por responder: …": el mensaje trae las preguntas pendientes.
- `422` si ya estaba finalizado; `409` si se finalizó en otro dispositivo justo antes.

Después, muestre el resumen en solo lectura: un chequeo finalizado no se edita.

---

## 7. Historial

`GET /mi-chequeo-diario/historial` trae los chequeos del conductor, del más reciente al más antiguo, paginados (`{ datos, total, pagina, limite }`). Los filtros `desde` y `hasta` van en formato `AAAA-MM-DD`.

En la lista no vienen los textos de las preguntas (`pregunta` y `calificacion` en `null`). Para el detalle completo use `GET /mi-chequeo-diario/historial/{id}`. Un chequeo de otro conductor responde `404`.

---

## 8. Flujo sugerido

1. **Inicio del conductor:** con `/mi-servicio` mostrando ambulancia, una tarjeta "Chequeo diario" que consulta `GET /mi-chequeo-diario`:
   - `chequeo: null` → "Pendiente";
   - `borrador` → "En curso";
   - `finalizado` → "Listo ✓".
2. **"Empezar":** `POST` → formulario con cada pregunta, sus opciones como botones y, si `permiteObservacion`, el interruptor "Agregar observación" con su campo de texto.
3. **Guardar:** `PUT` con cada cambio, o en lote. Sin señal, guarde en local y reenvíe después: es seguro, porque reemplaza.
4. **"Finalizar":** se habilita con `pendientes` vacío. Al terminar, el resumen en solo lectura.
5. **Día del chequeo:** es el día de Colombia y lo decide el backend. Cerca de la medianoche, confíe en el `fecha` que devuelve el `GET`.
