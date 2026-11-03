# Módulo de auditoría (`src/modules/audit`)

> Contexto general en [00-general.md](00-general.md).

## Qué hace

Registra las operaciones sensibles en la tabla `auditoria_eventos`. **No tiene endpoints**: solo expone el contrato `AuditoriaRepositorio` para que lo usen los demás módulos (`imports: [AuditModule]`).

## Contrato

```ts
interface EventoAuditoria {
  usuarioId: string | null;   // quién lo hizo (null si no está autenticado)
  entidad: string;            // tabla afectada: 'usuarios', 'sesiones', 'ambulancias', …
  entidadId: string;
  accion: string;             // 'crear', 'actualizar', 'cambiar_estado', …
  detalle?: { [clave: string]: ValorDetalleAuditoria };  // JSON
  direccionIp: string | null;
}

abstract class AuditoriaRepositorio {
  abstract registrar(evento: EventoAuditoria): Promise<void>;
}
```

Implementación: `infrastructure/repositories/prisma_auditoria.repository.ts`. Doble de prueba: `AuditoriaMemoria` en `test/dobles/repositorios_memoria.ts` (guarda en `eventos`).

## Reglas

- Se llama **al final del caso de uso**, después de persistir, con el `ContextoSolicitud` (`usuarioId`, `direccionIp`) que entrega `@Contexto()`.
- El `detalle` **no debe incluir secretos** (contraseñas, tokens) **ni datos clínicos**.

## Eventos registrados hoy

| Entidad | Acción | Detalle |
| --- | --- | --- |
| `usuarios` | `crear`, `actualizar`, `asignar_rol` | datos cambiados |
| `usuarios` | `cambiar_estado` | `estadoAnterior`, `estadoNuevo`, `motivo` |
| `usuarios` | `cambiar_contrasena` | — |
| `usuarios` | `inicio_sesion_fallido` | `motivo` (`usuario_inexistente`, `contrasena_invalida`, `usuario_<estado>`) |
| `sesiones` | `iniciar_sesion` | — |
| `ambulancias` | `crear` | `codigo`, `placa` |
| `ambulancias` | `actualizar` | `campos` enviados |
| `ambulancias` | `cambiar_estado` | `estadoAnterior`, `estadoNuevo`; `origen: 'tripulacion'` si lo causó una selección o salida (el motivo queda en `estados_ambulancia_historial`) |
| `emergencias` | `crear` | `numeroEmergencia`, `tipoIncidente`, `prioridad` |
| `emergencias` | `actualizar` | `campos` enviados; `prioridadAnterior` / `prioridadNueva` si cambió |
| `emergencias` | `cancelar` | `estadoAnterior`, `motivo` (solo aquí: la tabla no tiene columna de motivo) |
| `emergencias` | `marcar_duplicada` | `emergenciaPrincipalId`, `numeroPrincipal` |
| `turnos` | `seleccionar_ambulancia` | `ambulanciaId`, `funcion`, `turnoAnteriorId` |
| `turnos` | `salir_ambulancia` | `ambulanciaId`, `funcion`, `turnoSiguienteId` |
| `turnos` | `iniciar`, `reemplazar_integrantes` | Solo filas antiguas: ya no se generan desde el 2026-11-01 |
| `turnos` | `finalizar` | `ambulanciaId` |
| `asignaciones_servicio` | `despachar` | emergencia (id y número) y ambulancia (id y código) |
| `asignaciones_servicio` | `avanzar` | `estadoAnterior`, `estadoNuevo`, `emergenciaCerrada`; en la llegada, `distanciaEscenaMetros` y `fueraDeRadio` (el detalle completo de cada paso está en `eventos_asignacion`) |
| `asignaciones_servicio` | `cancelar` | `estadoAnterior`, `motivo`, `estadoEmergencia` |
| `asignaciones_servicio` | `definir_destino` | `estadoAsignacion`, `institucionAnteriorId`, `institucionAnterior`, `institucionNuevaId`, `institucionNueva` |
| `instituciones_salud` | `crear`, `actualizar`, `activar`, `inactivar` | `nombre` / `campos` |
| `historias_clinicas` | `abrir` | `numeroHistoria`, `asignacionId` |
| `historias_clinicas` | `consultar` | — (cada lectura del detalle queda registrada) |
| `historias_clinicas` | `actualizar` | `campos` (solo nombres, **nunca valores clínicos**) |
| `historias_clinicas` | `registrar_signo_vital`, `registrar_lesion`, `registrar_intervencion`, `eliminar_*` | `registroId` |
| `historias_clinicas` | `cerrar` | `numeroHistoria`, `hashCierre` |
| `historias_clinicas` | `anular` | `estadoAnterior`, `motivo` |
| `usuarios` | `registrar_ciudadano`, `actualizar_contacto` | `verificacionId` / `campos` (sin datos personales) |
| `verificaciones_identidad` | `consultar`, `decidir`, `reenviar` | `decidir`: `ciudadanoId`, `estadoAnterior`, `estadoNuevo`, `motivo`; `reenviar`: `camposCorregidos`, `ladosReemplazados` |
| `documentos_identidad` | `consultar` | `ciudadanoId`, `lado` (cada descarga de una foto) |

Los reportes de GPS no se auditan (la tabla `ubicaciones_ambulancias` ya es el registro).

> `campos` (en `actualizar`) lista solo lo que llegó con valor (incluye `null`). Hasta el 2026-10-24 usaba `Object.keys(datos)` y listaba también los campos no enviados; se corrigió en usuarios, ambulancias y emergencias.
