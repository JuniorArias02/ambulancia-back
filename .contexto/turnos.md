# Turnos y tripulaciones (dentro de `src/modules/ambulances`)

> Contexto general en [00-general.md](00-general.md). **Desde el 2026-11-01 la tripulación la arma cada persona desde la app: ver [seleccion-ambulancia.md](seleccion-ambulancia.md).** Guía para frontend: `docs/instrucciones-agente-frontend.md`.

## Qué hace

Define qué personas van en cada ambulancia (`turnos` + `turnos_integrantes`). Vive en el módulo `ambulances` porque el schema los agrupa ("Ambulancias y tripulaciones") y porque la regla "una ambulancia solo pasa a disponible con turno activo" la necesita el propio módulo (si fuera otro módulo, habría una dependencia circular).

## Endpoints

| Método | Ruta | Roles | Caso de uso |
| --- | --- | --- | --- |
| GET | `/turnos` | administrador, despachador | `ConsultarTurnos` (filtros `ambulanciaId`, `usuarioId`, `estado`; del más reciente al más antiguo) |
| GET | `/turnos/{id}` | administrador, despachador | `ObtenerTurno` |
| PATCH | `/turnos/{id}/finalizar` | administrador, despachador | `FinalizarTurno` (cerrar un turno que quedó abierto) |
| GET | `/mi-ambulancia/opciones` | conductor, paramédico | `ConsultarAmbulanciasSeleccionables` |
| POST | `/mi-ambulancia` | conductor, paramédico | `SeleccionarAmbulancia` |
| DELETE | `/mi-ambulancia` | conductor, paramédico | `SalirDeAmbulancia` |

## Entidad `Turno` (`domain/entities/turno.entity.ts`)

- Campos: `id`, `ambulanciaId`, `ambulanciaCodigo` (solo lectura), `inicio`, `fin`, `estado` (`activo` | `finalizado`), `integrantes` (`usuarioId`, `funcion`, `nombreCompleto` de solo lectura).
- Funciones (`FUNCIONES_TRIPULANTE`): `conductor`, `paramedico`, `medico`.
- `Turno.funcionDelRol(rol)`: `conductor` → `conductor`, `paramedico` → `paramedico`. `medico` se conserva para leer datos; ningún rol la toma hoy.
- Métodos: `iniciar()`, `reconstruir()`, `estaActivo()`, `incluyeA()`, `funcionDe()`, `tieneTripulacionCompleta()`, `tieneConductor()`, `estaLleno()`, `agregarIntegrante()`, `finalizar()`.

## Reglas

1. Un turno tiene **de 1 a 4 personas, un conductor como máximo** y nadie repetido. Puede estar incompleto: completo significa conductor + paramédico o médico.
2. **Una ambulancia tiene como máximo un turno activo y una persona está como máximo en uno.** Lo garantiza `TurnosRepositorio.enExclusiva()` (bloqueo de ambulancia y usuario).
3. Un turno con servicios conserva su tripulación; los cambios abren un turno nuevo (detalle en [seleccion-ambulancia.md](seleccion-ambulancia.md)).
4. **`CambiarEstadoAmbulancia` exige tripulación completa para pasar a `disponible`** → si no, `422`.
5. **Finalizar turno**:
   - con la ambulancia `en_servicio` → `422`;
   - si estaba `disponible`, pasa a `fuera_servicio` con el motivo "Fin de turno", en la misma transacción.
6. Auditoría en `entidad: 'turnos'`: `seleccionar_ambulancia`, `salir_ambulancia` y `finalizar`. Las filas antiguas de `iniciar` y `reemplazar_integrantes` se conservan.

## Exporta

`AmbulancesModule` exporta `TurnosRepositorio` (lo usan asignaciones y ubicaciones). Ya no importa `UsersModule`.

## Pruebas

`turno.entity.spec.ts`, `seleccion_ambulancia.use-case.spec.ts` y la regla de tripulación en `cambiar_estado_ambulancia.use-case.spec.ts`. Doble: `test/dobles/turnos_memoria.ts` (`new TurnosMemoria(ambulancias)` para usar `enExclusiva`; `conServicios` marca los turnos con asignaciones).

## Pendiente

- Exigir un `medico` en las ambulancias TAM (medicalizadas), si el negocio lo confirma; hoy no hay rol que tome esa función.
- Relevo de tripulación durante un servicio (ver "Inconsistencias" en [seleccion-ambulancia.md](seleccion-ambulancia.md)).
