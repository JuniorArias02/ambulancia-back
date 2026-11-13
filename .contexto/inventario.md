# Inventario de bodegas y ambulancias (`src/modules/inventory`)

> Contexto general en [00-general.md](00-general.md). Implementado el 2026-11-11 en la rama **`feat/inventario`**, que el documento pide independiente de la rama oficial. Requisitos: `docs/implementacion inventario.md`. Diseño de BD: `docs/bd-inventario.md`. Guías: `docs/INVENTARIO_FRONTEND.md` (web) y `docs/INVENTARIO_FLUTTER.md` (paramédico).

## Quién hace qué

| Rol | Dónde | Qué |
| --- | --- | --- |
| `administrador`, `despachador` | Web, `/inventario/*` | Catálogo, registros sanitarios, bodegas, ubicaciones, lotes, equipos y mantenimientos, movimientos, perfiles de dotación, existencias, alertas, controles y lectura de verificaciones. Tienen los mismos permisos |
| `paramedico` | App, `/mi-inventario/*` | Solo la ambulancia de **su turno activo** (función `paramedico`): ver existencias y dotación, consumos, devoluciones, verificaciones y temperatura. Lee el catálogo (`GET /inventario/insumos` y `GET /inventario/lotes`) |
| `conductor` y `ciudadano` | — | Sin acceso (`403`) |

## Base de datos

Migraciones: `20261111223838_inventario` y `20261113130557_revision_verificaciones` (3 columnas de revisión en `inv_verificaciones`; ver "Verificaciones"). La primera: **15 tablas `inv_`, solo aditiva** (no altera tablas existentes). Se aplicó a la BD local con `migrate deploy`. Modelos de Prisma: `Insumo`, `RegistroSanitario`, `Bodega`, `UbicacionInventario`, `Lote`, `Equipo`, `Existencia`, `MovimientoInventario`, `DetalleMovimiento`, `ControlAlmacenamiento`, `Mantenimiento`, `PerfilDotacion`, `DetallePerfilDotacion`, `VerificacionInventario` y `DetalleVerificacion`.

Agregado a mano al final de la migración (Prisma no modela `CHECK`):

| Restricción | Regla |
| --- | --- |
| `inv_ubicaciones_tipo_check` | Bodega **o** ambulancia, nunca las dos (la que pide el diseño) |
| `inv_existencias_cantidad_check` | `cantidad >= 0` |
| `inv_movimiento_detalles_cantidad_check` | `cantidad > 0` |
| `inv_perfil_dotacion_detalles_cantidades_check` | Requerida > 0 y `0 <= mínima <= requerida` |
| `inv_verificacion_detalles_cantidades_check` | Esperada y encontrada >= 0 |

**Única desviación del diseño:** las claves foráneas `bodega_id` y `ambulancia_id` de `inv_ubicaciones` usan `ON UPDATE RESTRICT` en lugar de `CASCADE`. MySQL no permite un `CHECK` sobre columnas con acciones referenciales (error 3823, comprobado), y los UUID nunca cambian.

## Decisiones de negocio

### Control de cada unidad

`clave_control` de existencias es `equipo:<id>`, `lote:<id>` o `insumo:<id>`, según las banderas del insumo:

- `requiereSerie` → por serie: exige `equipoId` y la cantidad es 1.
- `requiereLote` → por lote: exige `loteId`.
- Ninguna → solo cantidad.

Combinaciones inválidas: serie con lote, y vencimiento sin lote (el vencimiento vive en el lote). **Con historial** (existencias o movimientos) no se pueden cambiar `requiereLote` ni `requiereSerie` (`409`).

### Movimientos

- **El origen siempre resta y el destino siempre suma.**
  - El ajuste no tiene signo: lleva solo destino (aumenta) o solo origen (disminuye).
  - Por tipo:
    - entrada → bodega
    - consumo: desde una ambulancia
    - devolucion: ambulancia → bodega
    - baja: solo origen
    - transferencia: entre dos ubicaciones distintas
  - `motivo` es obligatorio en el ajuste y en la baja.
- **Estados:** `borrador` → `confirmado` | `anulado`. Solo un movimiento confirmado cambia existencias. Uno confirmado no se edita ni se anula: se corrige con un ajuste. Anular exige un motivo, que queda en la auditoría (la tabla no tiene columna para él).
- **Al crear y al confirmar se revalida** con la fecha de Colombia de ese momento:
  - Un lote vencido no va a una ambulancia ni se consume; sí se da de baja, se ajusta o se devuelve.
  - Un equipo dado de baja no se mueve.
  - Uno no operativo no va a una ambulancia.
- **Código:** `MOV-AAAAMMDD-XXXXXXXX` (día de Colombia y sufijo aleatorio).
- **Consumo con servicio** (`asignacion_id`): el servicio debe ser de la ambulancia de origen. Si lo registra el paramédico, también de **su turno**.
- **El paramédico:**
  - Su **consumo** se confirma de inmediato.
  - Su **devolución** queda en **borrador** hasta que la bodega la recibe y confirma.

### Concurrencia y consistencia

`PrismaMovimientosRepositorio`:

- **Todo en una transacción:** el movimiento, sus líneas y sus efectos.
- **Resta:** `UPDATE … WHERE cantidad >= x`. Si no alcanza, `409` con lo disponible y rollback completo.
- **Suma:** `INSERT … ON DUPLICATE KEY UPDATE` sobre `(ubicacion_id, clave_control)`, con `UTC_TIMESTAMP(3)`.
- **Orden de los efectos:** fijo (ubicación y clave), para no cruzar bloqueos.
- **Choques:** reintento hasta 3 veces ante un choque de transacciones (`P2034`).
- **Equipos:** después de aplicar, ningún equipo puede sumar más de 1 en todas las ubicaciones.
- **Confirmar o anular:** `updateMany where estado = 'borrador'`. Si `count = 0`, responde `409`.

En otros repositorios:

- **Verificaciones:** una sola en borrador por ubicación. `crear` bloquea la fila de la ubicación (`FOR UPDATE`), porque no hay índice que lo garantice. Los conteos bloquean la verificación y eliminan una fila duplicada de la misma unidad.
- **Perfiles:** activar bloquea el tipo de ambulancia (`FOR UPDATE`), de modo que nunca quedan dos activos del mismo tipo.
- **Duplicados por carrera:** un `P2002` en códigos, series, lotes y registros se traduce a `409` con `siDuplicado` (el filtro global no traduce Prisma).

### Perfiles de dotación

- **Creación:** nace **inactivo**. `POST` crea la versión 1 de un código; un código existente responde `409` y se usa **nueva versión**, que copia el perfil inactivo y sin vigencia.
- **Activación:** un solo perfil activo por tipo de ambulancia. Activar exige al menos un elemento y una vigencia que no haya terminado.
- **Cuál rige:** el activo del tipo, si hoy está dentro de su vigencia.
- **Comparación** (`domain/services/comparacion_dotacion.ts`): no cuenta lotes vencidos ni equipos no operativos. Estados:
  - `completo`: disponible ≥ requerida
  - `incompleto`: disponible ≥ mínima
  - `bajo_minimo`: por debajo; si la mínima es `null`, vale la requerida

### Verificaciones

- **Qué se compara:** `cantidad_esperada` es **lo que dice el sistema** (existencia de esa unidad en la ubicación), no lo que pide el perfil. Así faltante y sobrante indican diferencias con el registro, que se corrigen con un ajuste; la falta de dotación se ve en la comparación con el perfil. `perfil_detalle_id` se enlaza si el insumo está en el perfil vigente.
- **Estado de cada conteo:** lo calcula el servidor (conforme, faltante o sobrante; vencido si el lote venció). El paramédico puede indicar `danado`, que exige observación, o `vencido`; un estado que contradiga las cantidades responde `422`.
- **Al finalizar:** `inicio_turno` y `fin_turno` exigen contar todas las unidades con existencia; la `extraordinaria`, no. El resultado es `completada` o `con_novedades`.
- **Sin efecto en existencias:** la verificación no las cambia.
- **Quién continúa:** cualquier paramédico en turno de esa ambulancia puede continuar el borrador. El responsable es quien la inició.
- **Revisión de novedades (2026-11-13).** La central (administrador o despachador) cierra el ciclo con `POST /inventario/verificaciones/{id}/revision { resolucion }`. Se guardan `revisada_por_id`, `revisada_en` y `resolucion`.
  - Solo sobre las `con_novedades`, una sola vez: si ya fue revisada responde `409`; si está en borrador o completada, `422`.
  - El repositorio escribe con `updateMany where revisada_en IS NULL`: de 5 revisiones simultáneas pasa 1.
  - No cambia existencias: la corrección son los movimientos. Se recomienda citar sus códigos en la resolución.
  - Filtro `revisada=true|false`, que implica `con_novedades`.
  - La respuesta trae `pendienteDeRevision` y `revision`.
  - La revisión existe si `revisada_en` no es nulo: el revisor podría quedar en `NULL` por la FK `SET NULL`.
  - Migración `20261113130557_revision_verificaciones`: 3 columnas opcionales, un índice `(estado, revisada_en)`, una FK y el `CHECK` `inv_verificaciones_revision_check` (`revisada_en IS NULL OR estado = 'con_novedades'`).
  - **Se aparta del diseño oficial:** quedó anotado en `docs/bd-inventario.md`.
  - **Motivo:** sin revisión, la bandeja de novedades crecía sin fin y no quedaba constancia de cómo se atendió cada una.
  - **Guía:** `docs/INVENTARIO_REVISION_NOVEDADES_FRONTEND.md`.

### Ubicaciones

- La bodega crea su ubicación en la misma transacción. Desactivar la bodega desactiva su ubicación.
- La ubicación de una ambulancia se crea con `POST /inventario/ubicaciones/ambulancias` (idempotente) o **sola**, la primera vez que su paramédico abre el inventario.
- La ubicación de la ambulancia se puede desactivar. Entonces el paramédico recibe `422`.

### Otros

- **Responsable de bodega:** personal interno activo (`ROLES_INTERNOS`); se valida con `UsuariosRepositorio` de `UsersModule`.
- **Alertas** (`GET /inventario/alertas?dias=30`):
  - lotes con existencia que vencen o ya vencieron
  - mantenimientos próximos
  - registros sanitarios vigentes por vencer
  - insumos bajo `stock_minimo`, sumando solo las bodegas activas
- **Fechas:** las columnas `DATE` usan la medianoche UTC (`aFechaBd` y `deFechaBd`, igual que en checklists). Los filtros `desde` y `hasta` sobre `DATETIME` usan el día de Colombia (UTC−5). `fechaColombia()` se agregó a `common/utils/fecha_colombia.ts`.
- **Auditoría:** todas las escrituras, sin datos clínicos. En las ediciones solo se registran los campos enviados (`camposEnviados`).
- **Cambios fuera del módulo:**
  - `AmbulancesModule` ahora exporta `TiposAmbulanciaRepositorio`.
  - `app.module.ts` registra `InventoryModule`.

## Revisión de los documentos de requisitos (2026-11-11)

Puntos encontrados en `docs/implementacion inventario.md` y `docs/bd-inventario.md`, y cómo se resolvieron:

1. **El `CHECK` de `inv_ubicaciones` no se puede crear tal como está escrito:** MySQL lo rechaza por el `ON UPDATE CASCADE`. Se resolvió con `ON UPDATE RESTRICT` en esas dos claves foráneas.
2. **El diseño no impedía existencias negativas ni cantidades en 0:** se agregaron `CHECK`.
3. **`requiere_lote` vale 1 por defecto:** los insumos sin lote (gasas, guantes) deben crearse con `false`. Está advertido en la guía web.
4. **`inv_verificacion_detalles` no tiene un índice único por unidad:** se controla en la aplicación con bloqueo.
5. **`inv_movimientos` no tiene columna para el motivo de anulación:** queda en la auditoría.
6. **`inv_mantenimientos` no guarda quién lo registró:** queda en la auditoría. `responsable` es el técnico, en texto libre.
7. **Lo que el documento no definía y se decidió aquí:**
   - qué compara la verificación (el sistema, no el perfil)
   - que la devolución del paramédico espera la confirmación de la bodega
   - que el ajuste sea sin signo, con origen o destino
   - que haya un solo perfil activo por tipo
   - qué estados tiene el registro sanitario
   - que el despachador tenga los mismos permisos que el administrador

## Semillas

**Base** (`npm run db:semilla`, en cualquier ambiente). Está en `prisma/semillas/catalogo_inventario.ts` (datos) y `inventario_base.ts` (lógica):

- **80 insumos:**
  - soluciones y medicamentos, por lote, con vencimiento y registro sanitario;
  - medicamentos de control especial `MCE-*`: morfina, fentanilo, midazolam y diazepam;
  - oxígeno medicinal;
  - dispositivos médicos: acceso vascular, vía aérea, sondas e inmovilización;
  - insumos de atención;
  - 10 equipos biomédicos por serie.
- **Perfiles `DOT-TAB` (46 elementos) y `DOT-TAM` (79):** el TAM suma monitor con desfibrilador, ventilador, laringoscopio, bomba de infusión y medicamentos.
- **Referencias:** Resolución 3100 de 2019 (modificada por la 544 de 2023 y la 465 de 2025), Resolución 3316 de 2019 (DEA) y Resolución 1478 de 2006 (control especial). **Las cantidades son una base de trabajo**, no la transcripción del anexo técnico; cada prestador las ajusta desde la web.
- **Idempotente:**
  - un insumo que ya exista (por código) no se toca;
  - un perfil que ya exista (por tipo y código) no se crea otra vez;
  - un perfil solo se activa si su tipo no tiene otro activo.

**Demostración** (`npm run db:semilla:inventario-demo`, solo desarrollo; se niega a correr con `NODE_ENV=production`). Está en `prisma/semilla_inventario_demo.ts` y corre en una sola transacción. Crea:

- la bodega `BOD-CENTRAL`;
- registros sanitarios y lotes **ficticios** con prefijo `DEMO-` (no son datos reales de INVIMA);
- equipos `DEMO-EQ-xxx-nnn`: uno por ambulancia y uno de repuesto en bodega;
- una entrada confirmada a la bodega;
- una transferencia confirmada que abastece cada ambulancia según el perfil activo de su tipo.

Deja a propósito datos para las alertas:

- el lote `DEMO-SOL-001-VENCIDO`;
- el lote `DEMO-MED-001-PRONTO`, que vence en 20 días;
- un DEA de repuesto con mantenimiento en 10 días;
- `INS-014` (N95) bajo el stock mínimo (10 de 60).

Si ya corrió (movimientos con `documento_referencia = 'SEMILLA-DEMO-INVENTARIO'`), no hace nada. Si existe una `BOD-CENTRAL` creada a mano, se detiene.

**Ejecutadas en la BD local el 2026-11-11.** Antes se ensayaron en una copia: dos corridas de cada una sin duplicar nada, cero descuadres entre existencias y la suma de movimientos, y ningún equipo en dos lugares.

## Pruebas

- **Unitarias:** 55 en `src/modules/inventory/test/`. Cubren insumo, lote, equipo, movimiento, perfil, verificación, comparación de dotación y `UbicacionDelParamedico`. Los dobles están en `test/dobles/` del módulo.
- **Reales por HTTP:** 149 verificaciones y 143 solicitudes, sobre una copia de la BD con la API compilada aparte (puerto 3005). Pasaron todas sobre una copia limpia. Incluyen:
  - 5 inicios de verificación simultáneos que crean 1
  - 5 consumos simultáneos de 7 unidades sobre 28: pasan 4 y el quinto recibe `409`; la existencia queda en 0
  - rollback completo cuando no alcanza
  - un equipo que no puede estar en dos ubicaciones

  En la BD no quedaron existencias negativas, equipos duplicados ni borradores dobles.

## Pendiente

- Eventos de tiempo real del inventario (por ejemplo, una verificación con novedades hacia la central). Requeriría agregar el evento a la lista de permitidos del servidor WebSocket.
- Reportes y exportación.
