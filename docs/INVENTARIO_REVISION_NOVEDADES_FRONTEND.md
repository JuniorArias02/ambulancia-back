# Revisión de novedades de inventario

## 1. Para qué sirve

Cuando el paramédico termina una verificación con faltantes, sobrantes, vencidos o dañados, queda **`con_novedades`**. Hasta ahora no había forma de cerrarla, así que la bandeja crecía sin fin.

Con esto, la central **marca la verificación como revisada** y deja constancia de **quién**, **cuándo** y **cómo** resolvió las novedades. El ciclo queda completo:

```
Paramédico detecta  →  Bodega corrige (ajuste / baja / transferencia)  →  Central revisa y deja constancia
   (verificación)              (movimientos, ya existían)                   (NUEVO: este endpoint)
```

**La revisión no cambia existencias.** La corrección se hace **antes**, con los movimientos de siempre (ajuste, baja o transferencia). La revisión solo documenta lo que se hizo.

Pueden revisar los roles **`administrador`** y **`despachador`**.

---

## 2. Cambios en la API

### 2.1 Endpoint nuevo: `POST /api/v1/inventario/verificaciones/{id}/revision`

```json
{
  "resolucion": "Faltante de gasas repuesto con MOV-20261113-1A2B3C4D. Lote vencido de adrenalina dado de baja con MOV-20261113-5E6F7A8B."
}
```

| Campo | Tipo | Regla |
| --- | --- | --- |
| `resolucion` | texto | Obligatorio, máximo 2000 caracteres. **Recomiende citar los códigos de los movimientos** usados para corregir |

Respuesta `200`: la verificación completa (el mismo objeto de `GET /inventario/verificaciones/{id}`), ya con su `revision`.

Errores:

| Código | Cuándo | Qué mostrar |
| --- | --- | --- |
| `400` | Falta `resolucion`, está vacía o se envían campos no permitidos | Validación del formulario |
| `403` | El usuario no es administrador ni despachador | — |
| `404` | La verificación no existe | "No encontrada" |
| `409` | **Ya fue revisada**, posiblemente por otra persona al mismo tiempo | El `mensaje` y refrescar la bandeja |
| `422` | La verificación no está finalizada con novedades (está en borrador o completada), o la resolución solo tiene espacios | El `mensaje` |

Si dos personas revisan a la vez, solo una queda registrada y la otra recibe `409`.

### 2.2 Filtro nuevo: `GET /api/v1/inventario/verificaciones?revisada=`

| Valor | Devuelve |
| --- | --- |
| `revisada=false` | Verificaciones **con novedades pendientes de revisión**. **Úselo para la bandeja** |
| `revisada=true` | Verificaciones con novedades **ya revisadas** (historial) |
| Sin el parámetro | Todas, como antes |

`revisada` solo aplica a las verificaciones con novedades. Se combina con los demás filtros: `ubicacionId`, `responsableId`, `tipo`, `desde`, `hasta` y paginación.

### 2.3 Campos nuevos en cada verificación

Aparecen en el listado, en el detalle y en la respuesta del endpoint nuevo:

```json
{
  "id": "uuid",
  "estado": "con_novedades",
  "totalNovedades": 2,
  "pendienteDeRevision": false,
  "revision": {
    "revisadaPorId": "uuid",
    "revisadaPorNombre": "Laura Gómez",
    "revisadaEn": "2026-11-13T15:20:00.000Z",
    "resolucion": "Faltante de gasas repuesto con MOV-20261113-1A2B3C4D…"
  },
  "conteos": []
}
```

- **`pendienteDeRevision`:** `true` si tiene novedades y nadie las ha revisado. Úselo para el distintivo "Pendiente".
- **`revision`:** `null` mientras no se haya revisado, y siempre `null` en las verificaciones `completada` o en `borrador`.

---

## 3. Pantallas sugeridas

### 3.1 Bandeja "Novedades por revisar"

- **Datos:** `GET /inventario/verificaciones?revisada=false&pagina=1&limite=20`.
- **Columnas:** ambulancia (`ubicacionNombre`), tipo, responsable, finalizada, `totalNovedades`.
- **Contador en el menú:** use el `total` de esa consulta.

### 3.2 Detalle de una verificación pendiente

1. Muestre los conteos con novedad (`estado` distinto de `conforme`): esperado, encontrado, estado y observaciones.
2. Ofrezca **accesos directos para corregir**, que abran el formulario de movimiento con los datos ya llenos:
   - **faltante** → transferencia desde la bodega hacia esa ambulancia;
   - **vencido** o **dañado** → baja desde la ambulancia (o devolución);
   - **diferencia con el sistema** (faltante o sobrante sin explicación) → ajuste.
3. El botón **"Marcar como revisada"** abre un cuadro de texto obligatorio, **"¿Cómo se resolvió?"**. Si en la misma sesión se crearon movimientos, propóngalos en el texto (por ejemplo: "Repuesto con MOV-…").
4. Al confirmar, llame al endpoint y cierre la vista. Si recibe `409`, avise "Otra persona ya la revisó" y refresque.

### 3.3 Verificación ya revisada

Muestre un bloque fijo: *"Revisada por **{revisadaPorNombre}** el **{revisadaEn}**: {resolucion}"*. La revisión **no se edita ni se deshace**: queda como constancia.

---

## 4. Lo que no cambia

- La creación, los conteos y la finalización de las verificaciones (eso es de la app del paramédico).
- Las verificaciones `completada` no necesitan revisión.
- Las existencias: solo las cambian los movimientos.

---

## 5. Lista para comprobar la implementación

- [ ] La bandeja usa `revisada=false` y muestra el contador.
- [ ] El detalle muestra las novedades y permite crear el movimiento correctivo.
- [ ] "Marcar como revisada" exige el texto, y al guardar la verificación sale de la bandeja.
- [ ] Una verificación revisada muestra quién, cuándo y cómo, sin botón para editar.
- [ ] El `409` se maneja con un aviso y se refresca la bandeja.
- [ ] Las verificaciones `completada` no muestran el botón de revisar.
