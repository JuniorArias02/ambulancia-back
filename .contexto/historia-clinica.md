# Historia clínica prehospitalaria (`src/modules/prehospital_care`)

> Contexto general en [00-general.md](00-general.md).

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
| POST | `/historias-clinicas/{id}/cerrar` | paramédico (**firma**: `{ contrasena, aceptaDeclaracion: true }`, 5/min) |
| POST | `/historias-clinicas/{id}/anular` | **solo admin** |
| POST | `/historias-clinicas/{id}/valoraciones-downton` | paramédico |
| GET | `/historias-clinicas/{id}/valoraciones-downton` y `…/{valoracionId}` | paramédico, admin (**consulta auditada**) |
| GET | `/historias-clinicas/{id}/firma-cierre/imagen` | paramédico, admin (PNG de la firma estampada, **auditada**) |
| DELETE | `/historias-clinicas/{id}/valoraciones-downton/{valoracionId}` | paramédico |

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

## Escala de riesgo de caídas J.H. Downton (2026-11-13)

Tabla `valoraciones_downton`, migración `20261113205626_valoraciones_downton`, con la estructura exacta del diseño que entregó el equipo y 5 `CHECK` escritos a mano: estado mental, deambulación, origen, puntaje entre 0 y 12, y nivel coherente con el puntaje.

- **Opcional y repetible:** es una serie, como los signos vitales. No entra en `faltantesParaCerrar`. "Si la empiezan, la terminan" es regla de la **app**. El backend solo exige que cada valoración llegue **completa**: los 12 ítems obligatorios en el DTO.
- **Dominio:** `domain/entities/valoracion_downton.entity.ts`.
  - `calcularPuntajeDownton`: 1 punto por caídas previas, por cada medicamento y por cada déficit; `confuso` suma 1; deambulación `insegura` o `imposible` suma 1. Con `UMBRAL_RIESGO_ALTO_DOWNTON` (3) o más el riesgo es alto. Máximo 12.
  - **Deambulación `segura_con_ayuda` = 0 puntos, según la especificación del equipo.** Varias versiones publicadas de la escala le dan 1 punto. Si clínica lo confirma, se cambia en `PUNTOS_DEAMBULACION` (la prueba lo dejará en evidencia).
  - `crearValoracionDownton`: fecha hasta 60 s en el futuro; `voz` exige `segmentoAudioId` y `manual` no lo admite; `confirmado` siempre `true`, porque lo envía el paramédico; observación vacía → `null`.
  - El puntaje y el nivel **nunca** vienen del cliente: el DTO no los declara y `forbidNonWhitelisted` responde `400`.
- **Catálogos** (`catalogos_clinicos.ts`): `ESTADOS_MENTALES`, `DEAMBULACIONES`, `NIVELES_RIESGO_CAIDA`, `ORIGENES_REGISTRO` (`manual` o `voz`, igual que las otras tablas clínicas). Se exponen en `GET /historias-clinicas/catalogos`.
- **Aplicación:**
  - `RegistrarValoracionDownton`: con `cargarParaEditar` (tripulación clínica y borrador); valida que el segmento de audio sea de una grabación de **esa** historia. Usa el id del celular: reenviarlo devuelve la existente y en otra historia da `409`.
  - `ConsultarValoracionesDownton` y `ObtenerValoracionDownton`: lectura de la tripulación clínica más el admin; auditadas.
  - Quitar: reutiliza `RegistrarEnHistoria.eliminar('valoracion_downton', …)`.
- **Integración con la HC:** `DetalleHistoria.valoracionesDownton`, que va en el detalle, la apertura, el PATCH y el cierre. `HuellaHistoria` las incluye **solo si hay alguna**, para que las historias sin valoraciones conserven la misma huella que antes.
- **Repositorio:** los mismos métodos en `HistoriasClinicasRepositorio`: `agregarValoracionDownton`, `listarValoracionesDownton`, `buscarValoracionDownton`, `segmentoAudioDeHistoria`. Controlador aparte: `ValoracionesDowntonController`.
- **Auditoría:** `registrar_valoracion_downton`, `eliminar_valoracion_downton` y `consultar_valoracion_downton`, solo con `registroId`; `consultar_valoraciones_downton` sin detalle. Nunca el puntaje ni las respuestas.
- **Pruebas:**
  - entidad (12): tabla de puntos, umbral 2/3, máximo 12, fecha futura, voz/segmento;
  - casos de uso (9);
  - huella (+1).
  - Total del proyecto: **420**.
- **Prueba real (2026-11-13), 36/36 sobre una copia de la BD:**
  - roles: conductor, admin al registrar y paramédico de otro servicio → `403`;
  - incompleta, valores inválidos o `puntajeTotal`/`nivelRiesgo` enviados → `400`;
  - voz sin segmento, fecha futura o HC cerrada → `422`;
  - puntajes 2/bajo, 3/alto y 12/alto;
  - reenvío sin duplicar, y el mismo id en otra HC → `409`;
  - lista, detalle y detalle de la HC;
  - quitar → `204` y luego `404`;
  - en la BD: CHECK rechazan nivel incoherente, deambulación u origen inválidos y puntaje 13; la auditoría quedó sin valores clínicos.

## Firma electrónica del cierre (2026-11-13)

Sustento normativo en [firmas.md](firmas.md#sustento-normativo).

- **Norma:** la Resolución 1995 de 1999 (art. 5) exige la firma del **autor de cada anotación**, no de toda la tripulación; un sistema automatizado puede reemplazar la firma física si identifica al responsable y no deja modificar lo guardado. La Ley 527 de 1999 y el Decreto 2364 de 2012 aceptan la firma electrónica si corresponde **exclusivamente al firmante** y deja detectar alteraciones. El paciente firma solo cuando rechaza.
- **Antes:** la app generaba una "firma" de texto (un id) y cerraba con la sesión abierta: eso no identifica a quien firma.
- **Ahora:**
  - `CerrarHistoriaClinica.ejecutar(id, { contrasena, aceptaDeclaracion }, contexto)`: primero `cargarParaEditar` y luego `FirmaElectronicaHistoria.verificar`;
  - `FirmaElectronicaHistoria` (`application/services/firma_electronica.service.ts`) usa `UsuariosRepositorio` y `HashContrasena` de `UsersModule` (importado en el módulo);
  - una contraseña errada, o un usuario inexistente o inactivo, da `422` "no se firmó" (**no `401`**, para que la app no cierre la sesión) y la auditoría `firma_rechazada` con el motivo `credenciales_invalidas`;
  - si no acepta la declaración: `400` en el DTO (`@Equals(true)`) y `422` en el dominio.
- **Declaración:** en `domain/declaracion_firma.ts` (`DECLARACION_FIRMA_HISTORIA`, versión `v1`), expuesta en `catalogos.declaracionFirma`. La auditoría `cerrar` suma `metodoFirma: 'reautenticacion_contrasena'` y `versionDeclaracion`. **La contraseña nunca se registra.**
- `@Throttle` 5/min en `cerrar`, porque por ahí se puede adivinar la contraseña. Sin migración: la firma es `cerradaPorId` + `cerradaEn` + `hashCierre` + la auditoría.
- **Pruebas:**
  - unitarias +3: firma correcta con método en la auditoría; contraseña errada sigue en borrador, sin la contraseña en la auditoría; sin declaración;
  - total del proyecto: **423**;
  - real, 13/13: `400`, `422`, `403`, `200`, no se edita después, `429`; la auditoría no contiene la contraseña.
- **Pendiente:**
  - registro profesional (`usuarios.registro_profesional`: nadie lo llena) en la firma;
  - firma del paciente en el rechazo (`firma_rechazo_ref`, carga de la imagen);
  - firma de quien recibe (requiere columna nueva);
  - firma digital con certificado (opcional).

## Firma registrada estampada y régimen (2026-11-14)

- **Firma estampada:** `CerrarHistoriaClinica`, después de la contraseña, busca la firma **vigente** del profesional (`FirmasUsuariosRepositorio` de `signatures`, ver [firmas.md](firmas.md)).
  - Si no tiene: `422` *"Registre su firma en "Mi firma"…"*, salvo `FIRMA_CIERRE_OBLIGATORIA=false` (`PoliticaFirmaCierre`), que cierra sin firma.
  - Guarda `firma_cierre_id` y la entidad la expone como `firmaCierre { id, huellaSha256, registradaEn }`. El detalle la incluye; la imagen sale por `ObtenerFirmaCierre`, auditada como `consultar_firma_cierre`.
  - La auditoría `cerrar` suma `firmaCierreId`.
- **`HuellaHistoria.calcular(detalle, firmaCierre)`:** incluye `{ id, huellaSha256 }` de la firma, así cambiar la imagen rompe el sello. Los campos nuevos (`regimenAfiliacion`) y la firma solo entran si tienen valor, para que las historias anteriores den la misma huella.
- **Corrección:** antes, la huella se calculaba **antes** de que `cerrar` pusiera `entregadoEn` (desenlace `trasladado`), así que no cubría ese dato. Ahora `HistoriaClinica.cerrar` recibe `calcularHuella(historia)` y la calcula **después** de completar los datos. Hay una prueba que lo verifica.
- **Régimen de afiliación** (migración `20261115021319_regimen_afiliacion`):
  - `historias_clinicas.regimen_afiliacion`, opcional, con valores `contributivo`, `subsidiado`, `especial_excepcion` o `no_afiliado` y `CHECK` a mano;
  - `REGIMENES_AFILIACION` en `catalogos_clinicos.ts`, en el `PATCH` y en `catalogos.regimenesAfiliacion`.
- **Pruebas:** +4 (firma estampada con auditoría; sin firma `422` y en transición cierra; la huella cubre la firma y `entregadoEn`; régimen). Prueba real dentro de los 44/44 de [firmas.md](firmas.md).

## Relación con el destino del servicio

`institucionDestinoId` de la HC es dónde se entregó a cada paciente. Es **independiente** de `asignaciones_servicio.institucion_destino_id`, que dice a dónde va la ambulancia ([ruta-institucion.md](ruta-institucion.md)). Ninguno modifica al otro.

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

- **Voz**: grabación por trozos (incluida la propuesta de valoración Downton con `origen: 'voz'` y `confirmado: false`), transcripción, propuesta de campos (`datosExtraidos`) y confirmación del paramédico (`origen: 'voz'`, `confirmado`).
- **Firma del rechazo** (`firma_rechazo_ref`): subir la imagen.
- Vista web de consulta de HC para el administrador.
- ¿Exigir la HC cerrada para poder finalizar el servicio? Hoy son independientes.
