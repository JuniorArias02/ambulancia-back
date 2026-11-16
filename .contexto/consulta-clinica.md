# Consulta clínica web (`prehospital_care`, solo lectura)

> Contexto general en [00-general.md](00-general.md).

## Qué hace (fase 1, 2026-11-14)

El administrador consulta las historias clínicas como en un sistema hospitalario:
- **bandeja de búsqueda**;
- **ingreso o servicio completo**;
- **trazabilidad** de cada historia.

El expediente es el detalle que ya existía (`GET /historias-clinicas/{id}`). **No escribe nada**. Las rutas de la app no cambiaron.

## Endpoints (solo `administrador`)

| Método | Ruta | Caso de uso |
| --- | --- | --- |
| GET | `/consulta-clinica/historias` (filtros + paginación) | `BuscarHistoriasClinicas` |
| GET | `/consulta-clinica/ingresos/{numero o id}` | `ObtenerIngreso` |
| GET | `/consulta-clinica/historias/{id}/trazabilidad` | `ConsultarTrazabilidadHistoria` |

## Diseño

- **Repositorio de lectura aparte:** `ConsultaClinicaRepositorio` y `PrismaConsultaClinicaRepositorio`, para no mezclar las vistas con el repositorio que escribe las historias.
- **Dominio:** `domain/consulta_clinica.ts`, con los tipos de las vistas y funciones puras:
  - `rangoDesdeDias`: días de Colombia a UTC con `inicioDiaColombia` (a las 05:00 Z); `hasta` incluido; valida fecha inexistente, orden y un máximo de 366 días (`422`);
  - `estadosDelFiltro`: `vigentes` = borrador + cerrada, que es el valor por defecto;
  - `palabrasDeNombre` y `normalizarDocumento`;
  - `edadEnAnios`, a la fecha de la atención;
  - `filtrosUsados`, para la auditoría;
  - `calcularTiemposServicio`: despacho, alistamiento, respuesta, en escena, traslado y total, con `null` si falta una marca;
  - `muestrearRecorrido`: máximo 1500 puntos, siempre con el primero y el último;
  - `DESCRIPCIONES_ACCION_HISTORIA` y `tipoDeAccion`;
  - `CLAVES_DETALLE_TRAZABILIDAD`, la lista blanca del detalle.
- **Búsqueda (Prisma):**
  - un `AND` de filtros; la fecha sobre `abiertaEn`, `horaEvento` o `cerradaEn`, según `campoFecha`;
  - el ingreso y el número con `contains`; el documento exacto y normalizado;
  - el nombre: cada palabra con `startsWith` o `contains(' palabra')` sobre nombres o apellidos (inicio de palabra; la collation `utf8mb4_unicode_ci` ignora mayúsculas y tildes);
  - NN = `pacienteIdentificado: false`; riesgo de caída con `valoracionesDownton some/none nivel alto`; firmada con `firmaCierreId`;
  - el profesional es quien la creó **o** la cerró;
  - `count` y `findMany` en una transacción.
- **Ingreso:**
  - la emergencia con quien la recibió, la principal y las duplicadas;
  - las asignaciones con la ambulancia y su tipo, la tripulación del turno, quién asignó, el destino, los eventos, los movimientos de inventario con sus ítems (lote o serie), el recorrido y los tiempos;
  - todas las historias del ingreso, incluidas las anuladas.
  - Acepta el número `EMG-…` (en mayúsculas) o el UUID.
- **Trazabilidad:** `auditoria_eventos` de la entidad `historias_clinicas` y esa historia, en orden ascendente, con el usuario y su rol. Del detalle solo salen las claves de la lista blanca; la IP se separa en `direccionIp`.

## Auditoría

| Acción | Entidad | Detalle |
| --- | --- | --- |
| `buscar_historias` | `consulta_clinica` (`entidadId` = el usuario) | `{ filtros: [los nombres de los filtros usados], estado, resultados }`. **Nunca los valores buscados** |
| `consultar_ingreso` | `emergencias` | `{ numeroEmergencia, historias }` |
| `consultar_trazabilidad` | `historias_clinicas` | Se registra después de leer, para que no aparezca en su propio resultado |

## Base de datos (migración `20261115041946_indices_consulta_clinica`)

Solo índices: `historias_clinicas (abierta_en)`, `(hora_evento)`, `(cerrada_en)`, `(apellidos, nombres)` y `emergencias (recibida_en)`.

Por profesional y por destino ya existían los índices de las claves foráneas (`creada_por_id`, `cerrada_por_id`, `institucion_destino_id`); se revisó con `SHOW INDEX` para no duplicarlos.

## Pruebas

- **Unitarias (+15):**
  - dominio (10): fechas de Colombia, rango, estados, nombre y documento, edad, filtros sin valores, tiempos, muestreo, tipos de acción;
  - casos de uso (5): filtros armados, auditoría sin valores, rango inválido sin consultar, ingreso `404` y auditado, trazabilidad `404` y auditada después.
- **Total del proyecto:** 465.
- **Prueba real (2026-11-14), 48/48 sobre una copia de la BD (14 historias reales):**
  - `401` y `403`;
  - cada filtro: fecha de atención y de cierre, ingreso parcial en minúsculas, número, documento con puntos, nombre por inicio de palabra y sin tilde, NN, triage, desenlace, estado, firmada, riesgo, ambulancia, profesional, combinados;
  - los órdenes y la paginación;
  - validaciones `400` y `422`;
  - el ingreso por número y por id, con tripulación, 6 eventos, 156 puntos GPS e insumos con 19 ítems;
  - trazabilidad: `abrir` primero, lista blanca y registro de la consulta;
  - la auditoría de 20 búsquedas no contiene ningún documento ni nombre.

## Modalidad (2026-11-15)

El resumen trae `ingreso.modalidad` y el ingreso trae `emergencia.modalidad`. Hay filtro `?modalidad=`, que es un filtro por la emergencia. La trazabilidad describe `registrar_firma_*` (tipo `firma`), `eliminar_firma_*` y `consultar_firma_historia`; la lista blanca del detalle suma `proposito` y `conImagen`. Ver [firmas.md](firmas.md).

## Pacientes (2026-11-15)

**Tabla `pacientes`** (migración `20261115193907_pacientes`):
- Es el **índice maestro**: única por (tipo, número de documento), con nombres, apellidos, sexo y fecha de nacimiento, que son los **más recientes**.
- **`CHECK`:**
  - documento CC, TI, RC, CE, PA, PEP o PPT, **sin AS ni MS**, porque esos códigos significan "sin identificación" y no identifican a nadie;
  - número no vacío;
  - sexo dentro del catálogo.
- **`historias_clinicas.paciente_id`:** FK `RESTRICT`.
- **La historia conserva su propia copia** de los datos del paciente, tal como estaban en la atención: el índice solo une.

**Llenado inicial**, en la migración:
- un paciente por documento, con los datos de la atención más reciente (`INSERT IGNORE` ordenado de la más reciente a la más antigua);
- después, el enlace de todas las historias con ese documento.
- En la BD local quedaron 2 pacientes y 2 historias enlazadas.

**Enlace automático** (`IndicePacientes`, `PrismaIndicePacientes`):
- **Cuándo:** al abrir (si viene el documento) y en el `PATCH`, si cambió algún campo de `CAMPOS_IDENTIDAD`.
- **Cómo:** si `documentoEnlazable`, `upsert` del paciente (lo vacío no borra lo ya sabido) y `paciente_id`, en una transacción. Si no, deja la historia sin paciente: por ejemplo, al cambiar el documento a AS. **La app no cambió.**

**Lectura:**
- `GET /consulta-clinica/pacientes?documento=&nombre=`: paginado, por el inicio de cada palabra. Trae edad a hoy, total de atenciones, última atención, EPS y régimen.
- `GET /consulta-clinica/pacientes/{id}`:
  - todas sus atenciones con el resumen de la bandeja, incluidas las anuladas;
  - **alergias, medicamentos y antecedentes reunidos** con `reunir`: un valor por historia, sin repetir (sin distinguir mayúsculas), con la historia y la fecha de donde sale;
  - el **último riesgo de caída**.
- Auditoría: `buscar_pacientes` (filtros sin valores) y `consultar_ficha` (entidad `pacientes`).

## Indicadores y exportación (2026-11-15)

- **`GET /consulta-clinica/indicadores?desde=&hasta=`:** por defecto, los últimos 30 días hasta hoy en Colombia; máximo 366 días. `calcularIndicadores` (`domain/indicadores_clinicos.ts`) devuelve:
  - totales, firmadas, rechazos, NN y riesgo de caída alto;
  - conteos por estado, triage, desenlace, modalidad y tipo de evento (`sin_dato` para los vacíos);
  - **historias por día de Colombia**, con todos los días del rango;
  - las 10 instituciones de destino con más pacientes;
  - **tiempos** de respuesta, en escena y traslado (promedio, mediana y p90) de las asignaciones no canceladas de los ingresos recibidos en el rango.
  - Las historias del rango se cuentan por `abierta_en`. Auditoría: `consultar_indicadores`.
- **`GET /consulta-clinica/historias/exportar`:** los mismos filtros de la bandeja (`armarFiltrosBusqueda`, compartida), sin paginación.
  - **Máximo 5000 filas**: con más, responde `422`.
  - El archivo: `historiasACsv`, con separador `;`, UTF-8 con BOM (para Excel en español), fechas de Colombia, etiquetas en español y protección contra fórmulas (un valor que empieza con `= + - @` lleva un `'` adelante).
  - Auditoría: `exportar_historias`, con los filtros sin valores y el número de filas.

## PDF de la historia

`GET /historias-clinicas/{id}/pdf`, para la tripulación y el administrador. Ver [firmas.md](firmas.md) → "PDF".

## Pruebas (pacientes, indicadores, exportación y PDF)

- **Unitarias:** +15. Total del proyecto: 493.
- **Prueba real (2026-11-15), 21/21**, después de las partes de firmas:
  - PDF: cerrada, con 3 firmas más la del profesional, borrador, `403` y `404`;
  - pacientes: los del llenado inicial y el enlace del `PATCH`, búsqueda por documento con puntos y por nombre, la ficha con 2 atenciones y la alergia reunida; un documento AS quita el enlace; `404`;
  - indicadores: un rango de 61 días, por defecto 30, más de 366 → `422`;
  - CSV: BOM, 4 filas y nombre del archivo; paginación → `400`; paramédico → `403`;
  - la auditoría no guardó documentos ni nombres.

## Pendiente

- Un rol de solo consulta clínica (coordinador médico o auditor): hoy solo entra el administrador.
- Notas aclaratorias sobre historias cerradas: hoy solo se anulan.
- Fusionar pacientes duplicados (por ejemplo, el mismo paciente con CE y luego con PPT): hoy son dos pacientes.
