# Módulo de ubicaciones (`src/modules/locations`)

> Contexto general en [00-general.md](00-general.md). Guía para frontend: `docs/api-despacho-frontend.md` (sección 5).

## Qué hace

Recibe la posición GPS del celular de la tripulación (`ubicaciones_ambulancias`), actualiza la última ubicación de la ambulancia (columnas `ultima_*` de `ambulancias`) y entrega recorridos para el mapa de la web.

## Endpoints

| Método | Ruta | Roles | Caso de uso |
| --- | --- | --- | --- |
| POST | `/ubicaciones` | conductor, paramédico | `ReportarUbicacion` (`latitud`, `longitud`, `velocidad?`, `registradaEn?`) |
| GET | `/ubicaciones` | admin, despachador | `ConsultarRecorrido` (`asignacionId` o `ambulanciaId`, `desde`, `hasta`, `limite` 1–2000, por defecto 500) |

El **mapa en vivo** de la web usa `GET /ambulancias` (trae `ultimaUbicacion`); no hace falta un endpoint aparte.

## Reglas

1. **La ambulancia sale del turno activo de quien reporta**: nadie puede reportar la posición de una ambulancia en la que no va (arquitectura.md §9). Sin turno → `422`.
2. La posición se asocia a la **asignación activa** de esa ambulancia, si la hay (`asignacionId`).
3. `registradaEn` es la hora del celular (sirve si estuvo sin señal); si no viene, se usa la del servidor. Se aceptan hasta 60 segundos en el futuro (relojes adelantados) → si es mayor, `422`.
4. La última ubicación de la ambulancia **solo se actualiza si el punto es más reciente** que el guardado, porque los celulares envían en desorden al recuperar la señal. Se hace con un `updateMany` condicional, en la misma transacción que el `insert`.
5. El recorrido toma los **últimos N** puntos y los devuelve en **orden cronológico**.
6. Sin `asignacionId` ni `ambulanciaId` → `422`.
7. Los reportes de GPS **no se auditan** (serían miles de filas, y la propia tabla ya es el registro).

## Dependencias

Importa `AmbulancesModule` (`TurnosRepositorio`) y `AssignmentsModule` (`AsignacionesRepositorio`).

## Pendiente

- Envío por lotes (`POST /ubicaciones/lote`) si la app acumula muchos puntos sin señal.
- WebSocket para empujar las posiciones a la web en lugar de consultar cada 10–15 segundos.
- Política de retención o limpieza de `ubicaciones_ambulancias`, que crecerá rápido.
