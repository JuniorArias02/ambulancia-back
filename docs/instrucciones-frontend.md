
## 1. La regla nueva

| Rol | Puede | Ya no puede |
| --- | --- | --- |
| **Despachador** | Crear, editar y cambiar el estado de ambulancias; despachar; consultar tripulaciones; cerrar un turno que quedó abierto | Iniciar turnos ni elegir conductores o paramédicos |
| **Administrador** | Lo mismo | Lo mismo |
| **Conductor y paramédico** | Eligen su ambulancia desde Flutter | — |

La web **consulta** las tripulaciones, pero no las arma.

---

## 2. Qué eliminar

Rutas de `src/`, revisadas sin modificarlas:

| Archivo o elemento | Acción |
| --- | --- |
| `features/shifts/components/formulario_turno.tsx` | Eliminar |
| `features/shifts/components/lista_integrantes.tsx`, `fila_integrante.tsx` | Eliminar si solo los usa el formulario |
| `features/shifts/components/panel_turno.tsx` | Quitar lo de crear y editar; eliminar si no queda nada |
| `features/shifts/schemas/turno.schema.ts` y su prueba | Eliminar |
| `features/shifts/utils/tripulacion.ts` y su prueba | Eliminar o conservar solo lo que sirva para mostrar |
| `features/shifts/hooks/use_mutaciones_turno.ts` | Quitar `useIniciarTurno` y `useCambiarIntegrantes`; **conservar `useFinalizarTurno`** |
| `features/shifts/services/turnos.service.ts` | Quitar `iniciarTurno` y `cambiarIntegrantes` |
| `features/shifts/types/turno.types.ts` | Quitar `DatosIniciarTurno` y `DatosIntegrante`; agregar `tripulacionCompleta: boolean` a `Turno` |
| Parámetro `?iniciar=` en `/turnos` | Eliminar, también en `use_vista_turnos.ts` si lo procesa |
| Toda selección de usuarios para armar tripulación | Eliminar |

---

## 3. Qué ajustar

### Permisos: `features/ambulances/hooks/use_permisos_ambulancias.ts`

```ts
puedeGestionar: esAdministrador || usuario?.rol === 'despachador',
puedeCambiarEstado: esAdministrador || usuario?.rol === 'despachador',
```

`puedeVerAutores` no cambia. En `pagina_ambulancias.tsx`, cambie el texto "Un administrador debe registrar los vehículos de la flota".

### Detalle de ambulancia: `pagina_detalle_ambulancia.tsx` y `tripulacion_ambulancia.tsx`

- Quite la propiedad `puedeIniciarTurno` y el botón de iniciar turno.
- Sin turno, muestre: "Sin tripulación. El conductor y el paramédico la seleccionan desde la app".
- Con turno, muestre integrantes. Si `tripulacionCompleta` es `false`, indique qué falta.

### Cambiar estado: `dialogo_cambiar_estado_ambulancia.tsx` y su prueba

- Hoy detecta el caso con `/turno/i` y enlaza a `/turnos?iniciar=`. **Elimine la detección y el enlace.**
- El `422` ahora dice: "La ambulancia no tiene tripulación completa; el conductor y el paramédico deben seleccionarla desde la app". Muéstrelo como un error normal.
- Ajuste el texto de ayuda "Por ejemplo: inicio de turno…".
- La opción de pasar a `disponible` se conserva: sirve para reactivar una ambulancia que la central sacó de servicio con tripulación completa.

### Página de Tripulaciones: `pagina_turnos.tsx`, `barra_lateral.tsx`

Se conserva **solo como consulta**: turnos activos y finalizados, con la acción "Cerrar turno". Quite "Iniciar turno" y "Cambiar tripulación".

### Cerrar turno: `dialogo_finalizar_turno.tsx`

Explique para qué sirve: "Use esta acción si alguien olvidó salir o perdió el celular. La tripulación quedará sin ambulancia y deberá seleccionarla otra vez".

### Despacho

- Ofrezca solo las ambulancias `disponible` (ya implica tripulación completa).
- Mantenga el manejo de `409` y `422`: la tripulación puede cambiar justo antes de despachar.

### Comprobar también

`features/assignments/hooks/use_mutaciones_asignacion.ts` y `features/realtime/utils/aplicar_evento.ts` importan `CLAVES_TURNOS`: consérvelo. Corrija las pruebas afectadas.

---

## 4. Endpoints que sigue usando

Prefijo `/api/v1`, con `Authorization: Bearer`. Roles: administrador y despachador.

| Método | Ruta | Cambio |
| --- | --- | --- |
| GET | `/tipos-ambulancia` | — |
| POST | `/ambulancias` | **Ahora también el despachador** |
| GET | `/ambulancias`, `/ambulancias/{id}` | — |
| PATCH | `/ambulancias/{id}` | **Ahora también el despachador** |
| PATCH | `/ambulancias/{id}/estado` | `disponible` exige **tripulación completa** (`422`) |
| GET | `/ambulancias/{id}/historial-estados` | Aparecen cambios automáticos (abajo) |
| GET | `/turnos?ambulanciaId=&usuarioId=&estado=&pagina=&limite=` | Suma `tripulacionCompleta` |
| GET | `/turnos/{id}` | Suma `tripulacionCompleta` |
| PATCH | `/turnos/{id}/finalizar` | Sin cuerpo. `422` si está en servicio o ya finalizado; `409` si otro lo cerró antes |
| POST | `/asignaciones` | `422` sin tripulación completa; `409` si cambió durante el despacho |

**Eliminados:** `POST /turnos`, `PUT /turnos/{id}/integrantes`.

**No son para la web:** `/mi-ambulancia` y `/mi-ambulancia/opciones` responden `403` a estos roles.

### Objeto `Turno`

```json
{
  "id": "uuid",
  "ambulanciaId": "uuid",
  "ambulanciaCodigo": "AMB-03",
  "inicio": "2026-11-01T18:28:16.932Z",
  "fin": null,
  "estado": "activo",
  "integrantes": [
    { "usuarioId": "uuid", "nombreCompleto": "Pedro Díaz", "funcion": "conductor" }
  ],
  "tripulacionCompleta": false
}
```

Una persona sola forma un turno válido. **Ya no asuma** que todo turno tiene conductor y paramédico.

### Errores

Misma forma de siempre: muestre `mensaje`.

```json
{ "codigoEstado": 422, "error": "...", "mensaje": "...", "ruta": "...", "fecha": "..." }
```

---

## 5. Comportamientos nuevos que la web debe mostrar bien

1. **El estado de la ambulancia cambia sin que nadie lo toque en la web.** Pasa a `disponible` al completarse la tripulación y a `fuera_servicio` al quedar incompleta. En el historial aparecen los motivos "Tripulación completa desde la app" y "Tripulación incompleta desde la app".
2. **Hay más turnos que antes.** Si alguien sale, o entra a un turno que ya atendió servicios, el turno se cierra y sigue otro con la nueva tripulación. Una misma jornada puede verse como varias filas en "finalizados". No es un error: conserva quién atendió cada servicio.
3. **Tiempo real, sin eventos nuevos.**
   - `turno.actualizado` (`datos.turno`) y `ambulancia.actualizada` (`datos.ambulancia`).
   - Al cerrarse un turno y abrirse otro llegan dos `turno.actualizado` **sin orden garantizado**. Invalide o recargue la lista; no suponga que el último recibido es el vigente. El vigente es el que tiene `estado: "activo"`.

---

## 6. Pruebas sugeridas

1. Como despachador: crear y editar una ambulancia.
2. En ninguna pantalla se puede iniciar un turno ni elegir tripulantes, y no hay enlaces a `/turnos?iniciar=`.
3. Pasar a `disponible` sin tripulación: se muestra el mensaje del `422` sin enlaces.
4. Con Flutter (o Swagger, en `/mi-ambulancia`): al seleccionar conductor y paramédico, la web muestra la tripulación y `disponible` sin recargar.
5. Cerrar un turno abierto: la ambulancia queda `fuera_servicio`.
6. Cerrar un turno con servicio en curso: se muestra el `422`.
