# Lista de chequeo diaria: guía para el frontend web

**Para:** el agente del frontend web (`ambulancia/front`).
**Estado:** implementado en el backend el 2026-11-10, probado con peticiones HTTP reales y publicado en Swagger (`/api/docs`): secciones "Lista de chequeo: configuración" e "historial".

## 1. Qué hay que construir

| Pantalla | Rol | Para qué |
| --- | --- | --- |
| Configuración de la lista | `administrador` | Crear la lista, sus preguntas y opciones (Bien, Regular, Estable), activarla y editarla |
| Historial de chequeos | `administrador`, `despachador` | Ver qué revisó cada conductor en cada ambulancia, día por día, con observaciones |

**Reglas que la interfaz debe reflejar:**

- **Una sola lista activa:** activar una desactiva la anterior (lo hace el backend).
- **Nada se borra:** preguntas y opciones se **desactivan** (`activo: false`). No muestre "Eliminar".
- **El texto de una pregunta ya respondida no se puede cambiar** (`409`): desactívela y cree otra.
- **Siempre deben quedar** al menos 1 pregunta y 2 opciones activas (`422`).

## 2. Configuración: `administrador`

| Método | Ruta | Cuerpo | Éxito |
| --- | --- | --- | --- |
| POST | `/listas-chequeo` | Ver ejemplo | `201` (nace **inactiva**) |
| GET | `/listas-chequeo?activa=&busqueda=&pagina=&limite=` | — | `200` paginado |
| GET | `/listas-chequeo/{id}` | — | `200` con todas sus preguntas y opciones, también las inactivas |
| PATCH | `/listas-chequeo/{id}` | `{ nombre?, descripcion? }` | `200` |
| PATCH | `/listas-chequeo/{id}/estado` | `{ "activa": true \| false }` | `200` |
| POST | `/listas-chequeo/{id}/items` | `{ pregunta, orden?, obligatorio?, permiteObservacion? }` | `201` lista actualizada |
| PATCH | `/listas-chequeo/{id}/items/{itemId}` | `{ pregunta?, orden?, obligatorio?, permiteObservacion?, activo? }` | `200` |
| POST | `/listas-chequeo/{id}/estados` | `{ nombre, valor?, orden? }` | `201` |
| PATCH | `/listas-chequeo/{id}/estados/{estadoId}` | `{ nombre?, valor?, orden?, activo? }` | `200` |

Crear:

```json
{
  "nombre": "Chequeo diario",
  "descripcion": "Antes del turno",
  "items": [
    { "pregunta": "¿Nivel de aceite?" },
    { "pregunta": "¿Luces y sirena?", "permiteObservacion": false },
    { "pregunta": "¿Botiquín completo?", "obligatorio": false }
  ],
  "estados": [
    { "nombre": "Bien", "valor": 2 },
    { "nombre": "Regular", "valor": 1 },
    { "nombre": "Estable", "valor": 0 }
  ]
}
```

**Límites:**

| Campo | Límite |
| --- | --- |
| `nombre` | 150 |
| `descripcion` | 255 |
| `pregunta` | 500 |
| Nombre de la opción | 60 |
| Preguntas / opciones | Mínimo 1 pregunta y 2 opciones |
| `orden` | Entero ≥ 0 (si no viene, la posición) |
| `obligatorio`, `permiteObservacion` | Por defecto `true` |

Respuesta (lista):

```json
{
  "id": "uuid",
  "nombre": "Chequeo diario",
  "descripcion": "Antes del turno",
  "activa": false,
  "creadaEn": "…",
  "actualizadaEn": null,
  "items": [{ "id": "uuid", "pregunta": "¿Nivel de aceite?", "orden": 0, "obligatorio": true, "permiteObservacion": true, "activo": true }],
  "estados": [{ "id": "uuid", "nombre": "Bien", "valor": 2, "orden": 0, "activo": true }]
}
```

**Errores:**

| Código | Cuándo |
| --- | --- |
| `400` | Validación, campo de más (también dentro de cada pregunta u opción) |
| `404` | La lista, la pregunta o la opción no existe |
| `409` | Se intentó cambiar el texto de una pregunta ya respondida |
| `422` | Pregunta u opción repetida (sin importar mayúsculas), vacía, o quedarían menos de 1 pregunta o 2 opciones activas |

**Pantalla sugerida:**

- Tabla de listas con una insignia "Activa" y el botón "Activar". Confirmación: "La lista activa actual dejará de usarse".
- Editor de la lista: dos secciones, preguntas y opciones, que se reordenan con `orden`. Interruptores para "Obligatoria", "Admite observación" y "Activa".
- Al recibir un `409` por cambiar el texto, ofrezca "Desactivar y crear una nueva".

## 3. Historial: `administrador` y `despachador`

| Método | Ruta | Parámetros |
| --- | --- | --- |
| GET | `/chequeos-diarios` | `conductorId`, `ambulanciaId`, `estado` (`borrador` \| `finalizado`), `desde`, `hasta` (`AAAA-MM-DD`), `pagina`, `limite` |
| GET | `/chequeos-diarios/{id}` | — |

Cada chequeo:

```json
{
  "id": "uuid",
  "fecha": "2026-11-10",
  "estado": "finalizado",
  "iniciadoEn": "…",
  "finalizadoEn": "…",
  "listaChequeoId": "uuid",
  "ambulanciaId": "uuid",
  "ambulanciaCodigo": "AMB-01",
  "conductorId": "uuid",
  "conductorNombre": "Pedro Díaz",
  "respuestas": [
    { "itemId": "uuid", "pregunta": "¿Nivel de aceite?", "estadoId": "uuid", "calificacion": "Regular", "tieneObservacion": true, "observacion": "Bajo, se rellenó", "respondidoEn": "…" }
  ],
  "pendientes": []
}
```

- **En la lista**, `pregunta` y `calificacion` vienen en `null`: muestre fecha, ambulancia, conductor, estado y cuántas respuestas tienen observación.
- **En el detalle** (`/{id}`) vienen con texto, aunque la pregunta se haya desactivado después.
- Resalte las respuestas con observación y las calificaciones distintas de la mejor: son las novedades de la ambulancia.
- Fecha inválida → `400`.
