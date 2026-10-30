# Historia clínica prehospitalaria (`src/modules/prehospital_care`)

> Contexto general en [00-general.md](00-general.md). Guía para Flutter: `docs/api-historia-clinica-app.md`.

## Qué hace

La historia clínica (HC) de cada paciente atendido en una emergencia: una HC por paciente (un servicio con varias víctimas tiene varias). Primera versión **manual**. La voz (escucha continua: tablas `grabaciones` y `segmentos_audio`) queda para una fase siguiente.

**No requirió migración**: las tablas `historias_clinicas`, `signos_vitales`, `lesiones` e `intervenciones` ya existían en la migración `inicial`.

## Endpoints

| Método | Ruta | Roles |
| --- | --- | --- |
| GET | `/historias-clinicas/catalogos` | paramédico, admin |
| POST | `/historias-clinicas` | paramédico |
| GET | `/historias-clinicas?asignacionId=` (admin también `?emergenciaId=`) | paramédico, admin |
| GET | `/historias-clinicas/{id}` | paramédico, admin (**consulta auditada**) |
| PATCH | `/historias-clinicas/{id}` | paramédico |
| POST / DELETE | `/historias-clinicas/{id}/signos-vitales`, `…/lesiones`, `…/intervenciones` | paramédico |
| POST | `/historias-clinicas/{id}/cerrar` | paramédico |
| POST | `/historias-clinicas/{id}/anular` | **solo admin** |

`catalogos` se declara antes de `:id` en el controlador para que no se tome como un id.

## Acceso (`AccesoHistoriaClinica`)

- Crear y editar: solo quien está en el **turno de la asignación** con la función **`paramedico` o `medico`**. Se usa `turno.integrantes` aunque el turno ya haya terminado, para que puedan completar después de entregar al paciente.
- Leer: esa misma tripulación clínica + el **administrador**.
- **Conductor y despachador: sin acceso** a datos clínicos (`arquitectura.md` §7 y §9). El `RolesGuard` ya los frena por rol (`403`).
- `cargarParaEditar(id)`: la HC existe, es de su tripulación y está en `borrador`.

## Dominio

- `catalogos_clinicos.ts`: estados (`borrador`, `cerrada`, `anulada`), tipos de documento (CC, TI, RC, CE, PA, PEP, PPT, AS, MS), sexo, tipo de evento, rol de la víctima, triage, desenlace, región corporal, tipo de lesión y tipo de intervención.
- `HistoriaClinica`:
  - `abrir`, `reconstruir`, `actualizar` (con `fusionarDefinidos`: `undefined` no toca y `null` borra);
  - normaliza los textos (vacío → `null`), el documento (sin puntos ni guiones) y la placa (mayúsculas sin espacios);
  - `faltantesParaCerrar`, `cerrar` (exige que no falte nada, sella con el hash y pone `entregadoEn` si fue trasladado y no lo tenía), `anular`;
  - `formatearNumero` → `HC-AAAAMMDD-NNNN`.
- **Reglas de cierre:**
  - siempre: `triage` y `desenlace`;
  - paciente identificado → `nombres` o `numeroDocumento`;
  - `trasladado` → `institucionDestinoId` + `receptorNombre`;
  - `rechazo_traslado` → `motivoRechazo`;
  - al menos una toma de signos vitales, salvo `fallecido_en_sitio`.
- `registros_clinicos.ts`:
  - `crearSignoVital`: al menos una medición; diastólica < sistólica; **`glasgowTotal` calculado** con las tres partes;
  - `crearLesion`;
  - `crearIntervencion`: nombre obligatorio.

## Aplicación

- `AbrirHistoriaClinica`:
  - **id del celular** (sin señal): si ya existe en la misma asignación, devuelve la misma (`creada: false`); si es de otra, `409`;
  - no se abre en un servicio cancelado;
  - `abiertaEn` hasta 60 s en el futuro;
  - número consecutivo diario (hora de Colombia, `common/utils/fecha_colombia.ts`), con 3 reintentos si dos se abren a la vez.
- `ActualizarHistoriaClinica`: valida que la institución de destino exista y esté activa, y devuelve el detalle completo.
- `RegistrarEnHistoria`: `signoVital`, `lesion`, `intervencion` y `eliminar`. Los registros llegan con id del celular y el repositorio devuelve el existente si se reenvía.
- `CerrarHistoriaClinica`: calcula `HuellaHistoria` (SHA-256 de un JSON con las claves ordenadas: datos y registros ordenados por id, sin los nombres de quién registró), cierra y guarda.
- `AnularHistoriaClinica`: el contenido no se borra; el motivo queda en la auditoría (la tabla no tiene columna de motivo de anulación).
- `ObtenerHistoriaClinica`: audita cada consulta (`consultar`).

## Infraestructura

`PrismaHistoriasClinicasRepositorio`:
- `select` explícitos;
- `actualizar` con control optimista por `estado`;
- los registros se crean con `origen: 'manual'` y `confirmado: true`;
- un id reenviado de otra historia → `409`;
- un valor de catálogo desconocido en la BD se lee como `null`, en lugar de romper la lectura.

## Auditoría

Solo identificadores y nombres de campos, **nunca valores clínicos**: `abrir`, `consultar`, `actualizar` (`campos`), `registrar_*` y `eliminar_*` (`registroId`), `cerrar` (`hashCierre`), `anular` (`motivo`).

## Pruebas (23)

- Entidad (7).
- Registros (4): Glasgow, sin mediciones, presión, intervención.
- Huella (2): mismo contenido = misma huella sin importar el orden; un cambio la cambia.
- Casos de uso (10): número consecutivo, reintento con el mismo id, conductor sin acceso, otro paramédico sin acceso y admin con acceso, signos sin duplicar, institución inexistente, flujo completo con cierre y bloqueo, auditoría sin datos clínicos, lista, anulación.
- Dobles en `prehospital_care/test/dobles/historias_memoria.ts`.

Total del proyecto: **191**.

## Prueba real (2026-10-25)

Escenario AMB-02 (Lucía paramédica, Carlos conductor):
- abrir con el id del celular → `HC-20261025-0001`; reintento → la misma;
- conductor intenta abrir o ver → `403`;
- PATCH normaliza el documento (`1090123456`) y la placa (`ABC12D`); un sexo inválido → `400`;
- signos vitales → Glasgow 15; reenvío con el mismo id → devuelve el existente; FC 900 → `400`;
- lesión e intervención → `201`;
- cerrar incompleta → `422` "falta: desenlace";
- completar y cerrar → hash, destino y `entregadoEn`;
- editar cerrada → `422`; el admin ve el detalle;
- la auditoría quedó sin ningún valor clínico.

**Detalle conocido:** reenviar un registro con el mismo id no lo duplica, pero sí deja una segunda fila de auditoría `registrar_*` (registra el intento).

## Pendiente

- **Voz**: grabación por trozos, transcripción, propuesta de campos (`datosExtraidos`) y confirmación del paramédico (`origen: 'voz'`, `confirmado`).
- **Firma del rechazo** (`firma_rechazo_ref`): subir la imagen.
- Vista web de consulta de HC para el administrador.
- ¿Exigir la HC cerrada para poder finalizar el servicio? Hoy son independientes.
