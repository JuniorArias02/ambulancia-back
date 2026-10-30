# Turnos y tripulaciones (dentro de `src/modules/ambulances`)

> Contexto general en [00-general.md](00-general.md). Guía para frontend: `docs/api-despacho-frontend.md` (sección 3).

## Qué hace

Define qué personas van en cada ambulancia (`turnos` + `turnos_integrantes`). Vive en el módulo `ambulances` porque el schema los agrupa ("Ambulancias y tripulaciones") y porque la regla "una ambulancia solo pasa a disponible con turno activo" la necesita el propio módulo (si fuera otro módulo, habría una dependencia circular).

## Endpoints (administrador y despachador)

| Método | Ruta | Caso de uso |
| --- | --- | --- |
| POST | `/turnos` | `IniciarTurno` |
| GET | `/turnos` | `ConsultarTurnos` (filtros `ambulanciaId`, `usuarioId`, `estado`; del más reciente al más antiguo) |
| GET | `/turnos/{id}` | `ObtenerTurno` |
| PUT | `/turnos/{id}/integrantes` | `ReemplazarIntegrantesTurno` |
| PATCH | `/turnos/{id}/finalizar` | `FinalizarTurno` |

## Entidad `Turno` (`domain/entities/turno.entity.ts`)

- Campos: `id`, `ambulanciaId`, `ambulanciaCodigo` (solo lectura), `inicio`, `fin`, `estado` (`activo` | `finalizado`), `integrantes` (`usuarioId`, `funcion`, `nombreCompleto` de solo lectura).
- Funciones (`FUNCIONES_TRIPULANTE`): `conductor`, `paramedico`, `medico`.
- `Turno.puedeCumplir(rol, funcion)`: el rol `conductor` solo puede ir como `conductor`; el rol `paramedico` puede ir como `paramedico` o `medico` (no existe un rol médico).
- Métodos: `iniciar()`, `reconstruir()`, `estaActivo()`, `incluyeA()`, `reemplazarIntegrantes()`, `finalizar()`.

## Reglas

1. Tripulación de **2 a 4 personas**, con **al menos un conductor y al menos un paramédico o médico**, y sin personas repetidas → si no, `422`.
2. **Una ambulancia tiene como máximo un turno activo** → si no, `409`. En `PrismaTurnosRepositorio.crear` se bloquea la fila de la ambulancia (`SELECT … FOR UPDATE`) y se vuelve a contar dentro de la transacción, para que dos solicitudes simultáneas no creen dos turnos.
3. `ValidadorTripulacion` (servicio de aplicación, compartido por iniciar y reemplazar) revisa que cada usuario exista y esté `activo`, que su rol permita la función (`422`) y que **no esté en el turno activo de otra ambulancia** (`409`).
4. Iniciar un turno **no** habilita la ambulancia: luego se pasa a `disponible` con `PATCH /ambulancias/{id}/estado`.
5. **`CambiarEstadoAmbulancia` exige turno activo para pasar a `disponible`** → si no, `422`.
6. **Finalizar turno**:
   - con la ambulancia `en_servicio` → `422`;
   - si estaba `disponible`, primero pasa a `fuera_servicio`, con el motivo "Fin de turno" en el historial, y después se finaliza el turno. Ese orden garantiza que nunca quede una ambulancia disponible sin tripulación.
7. Auditoría en `entidad: 'turnos'`: `iniciar`, `reemplazar_integrantes` (con los integrantes anteriores y los nuevos) y `finalizar`.

## Exporta

`AmbulancesModule` exporta `TurnosRepositorio` (lo usan asignaciones y ubicaciones) e importa `UsersModule` (necesita `UsuariosRepositorio`).

## Pruebas

`turno.entity.spec.ts` (5 pruebas) y la regla de turno en `cambiar_estado_ambulancia.use-case.spec.ts`. Doble: `test/dobles/turnos_memoria.ts` (`TurnosMemoria`, `crearTurnoPrueba`, `TRIPULACION_PRUEBA`).

## Pendiente

- Exigir un `medico` en las ambulancias TAM (medicalizadas), si el negocio lo confirma.
- La validación "no está en otro turno" puede fallar si se asigna a la misma persona en dos ambulancias distintas exactamente al mismo tiempo (no hay bloqueo por usuario). Es muy improbable.
