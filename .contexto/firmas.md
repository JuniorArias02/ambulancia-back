# Firmas de los profesionales (`src/modules/signatures`)

> Contexto general en [00-general.md](00-general.md).

## Sustento normativo

Investigación del 2026-11-13, solo con normas colombianas. **No es un concepto jurídico:** antes de producción, debe validarlo el área de calidad o jurídica de la institución.

- **Resolución 1995 de 1999, art. 5:** cada anotación de la historia lleva la fecha, la hora, el nombre completo y la **firma de su autor**. No exige que firme toda la tripulación: firma quien registra. El conductor no firma, porque no registra información clínica.
- **Arts. 5 y 18 de la misma resolución:** un sistema automatizado puede **reemplazar la firma física** si identifica al responsable y no deja modificar lo guardado.
- **Ley 527 de 1999 (art. 7), Decreto 2364 de 2012 (compilado en el Decreto 1074 de 2015) y Ley 2015 de 2020:** la firma electrónica vale como la manuscrita si identifica **exclusivamente al firmante** en el momento de firmar y permite **detectar alteraciones**. La historia clínica electrónica se presume auténtica.
- **Por eso:**
  - una firma "de texto" (un id) o un dibujo solo **no bastan**, porque cualquiera con el celular de la ambulancia podría producirlos;
  - la validez la dan la **contraseña escrita al firmar** y la **huella del contenido**;
  - la imagen registrada es lo que se ve y lo que va en el PDF.
- **Ley 23 de 1981 y Decreto 3380 de 1981, art. 12:** en el **disentimiento** (el paciente rechaza el traslado) debe quedar constancia en la historia. Lo usual es la firma del paciente o de un familiar mayor de edad, y un testigo si se niega. Implementado en la fase 2 (ver abajo).
- **La firma de quien recibe en el hospital** no apareció como exigencia nacional: es una práctica que ayuda en los cobros al SOAT y la ADRES (Resolución 1236 de 2023). Está en la fase 4.
- **Fuentes:**
  - [Resolución 1995 de 1999](https://normograma.supersalud.gov.co/compilacion/docs/resolucion_minsalud_r1995_99.htm) y [Resolución 839 de 2017](https://www.saludcapital.gov.co/DDS/Documentos_I/Res_839_2017.pdf);
  - [Decreto 2364 de 2012](https://normograma.supersalud.gov.co/compilacion/docs/decreto_2364_2012.htm) y [Ley 2015 de 2020](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=105472);
  - [Decreto 3380 de 1981](https://normograma.supersalud.gov.co/compilacion/docs/decreto_3380_1981.htm) y [Ley 23 de 1981](https://normativa.colpensiones.gov.co/compilacion/docs/ley_0023_1981.htm);
  - [Resolución 1236 de 2023](https://normograma.supersalud.gov.co/compilacion/docs/resolucion_minsaludps_1236_2023.htm).

## Qué hace (fase 1, 2026-11-14)

Cada paramédico **registra su propia firma** (dibujo PNG + su contraseña) y el backend la **estampa** en cada historia clínica que cierra. La imagen queda **cifrada** en el disco del servidor. La base de datos solo guarda la referencia y los datos.

- **Nunca se sobrescribe:** registrar otra deja la anterior como `reemplazada`.
- **Cada historia guarda la versión exacta** que se estampó (`historias_clinicas.firma_cierre_id`).
- El administrador **consulta y desactiva**, pero **no sube** firmas de otros.

## Endpoints

| Método | Ruta | Roles |
| --- | --- | --- |
| GET | `/mi-firma` → `{ registrada, firma }` | paramédico |
| GET | `/mi-firma/imagen` (PNG, `no-store`, auditada) | paramédico |
| POST | `/mi-firma` (multipart `imagen` + `contrasena`, 5/min) | paramédico |
| GET | `/usuarios/{usuarioId}/firmas` | admin |
| GET | `/usuarios/{usuarioId}/firmas/{firmaId}/imagen` (auditada) | admin |
| POST | `/usuarios/{usuarioId}/firmas/{firmaId}/desactivar` `{ motivo }` | admin |
| GET | `/historias-clinicas/{id}/firma-cierre/imagen` (auditada; en `prehospital_care`) | paramédico de la tripulación, admin |

## Base de datos (migración `20261115021430_firmas_usuarios`)

- **`firmas_usuarios`:** `usuario_id`, `clave_almacenamiento` (única), `tipo_mime`, `tamano_bytes`, `ancho_px`, `alto_px`, `huella_sha256`, `vigente`, `registrada_en`, `reemplazada_en`, `desactivada_en`, `desactivada_por_id`, `motivo_desactivacion`. Índice `(usuario_id, vigente)`. Mismo estilo que `documentos_identidad` (`vigente` + fechas).
- **`CHECK` a mano:**
  - `tipo_mime = 'image/png'`;
  - la huella es hexadecimal de 64 caracteres;
  - tamaño de 1 a 204800 bytes y dimensiones mayores que 0;
  - estado coherente: vigente sin fechas de reemplazo ni de desactivación, o no vigente con alguna de las dos;
  - motivo si y solo si está desactivada.

  El estado se valida con las fechas porque las columnas con clave foránea no pueden ir en un `CHECK` (MySQL 3823).
- **`historias_clinicas.firma_cierre_id`:** FK con `ON DELETE RESTRICT`: una firma usada nunca se borra.
- **Una sola vigente por usuario:** MySQL no tiene índices únicos parciales, así que `registrar` hace `SELECT … FROM usuarios … FOR UPDATE`, deja la vigente como reemplazada y crea la nueva en una transacción. Probado con 5 registros simultáneos: queda una sola vigente.

## Almacenamiento y cifrado

- **`AlmacenamientoFirmasCifrado`:** guarda en `ALMACENAMIENTO_PRIVADO_RUTA/firmas/<uuid>`, con permisos 0700/0600, en modo `wx` (nunca sobrescribe) y solo con claves UUID generadas por el backend.
- **Cifrado:** AES-256-GCM. El archivo es `"GF"` + la versión del formato + la versión de la clave + IV (12) + etiqueta (16) + el contenido cifrado. La clave interna del archivo va como **dato autenticado**: copiar un archivo encima de otro no se descifra.
- **Variables:**
  - `FIRMAS_CLAVE_CIFRADO`: 32 bytes en base64, obligatoria en producción;
  - `FIRMAS_CLAVE_VERSION`, por defecto 1;
  - `FIRMAS_CLAVES_ANTERIORES`: `version:clave,…`, para leer después de rotar;
  - sin clave, el almacenamiento responde `ServicioNoDisponibleError` (503).
- **`LectorImagenFirma`:** descifra y compara la huella SHA-256 con la guardada. Si no coincide, lanza `FirmaAlteradaError` (500) y no entrega la imagen.
- **Respaldo:** la base de datos, la carpeta `firmas/` y la clave **van juntas**. Sin la clave, las firmas son ilegibles.
- Las fotos de la cédula de los ciudadanos siguen en su propio almacenamiento **sin cifrar**. Cifrarlas requiere migrar los archivos existentes: queda pendiente.

## Dominio y aplicación

- **`FirmaUsuario`:** `registrar` crea una vigente; `desactivar` exige que esté vigente y un motivo de al menos 5 caracteres; `estado` es `vigente`, `reemplazada` o `desactivada`.
- **`validarImagenFirma`:** revisa el contenido real: la firma PNG, `IHDR` y el `IEND` final (archivo completo), hasta 200 KB, entre 150x50 y 2000x1000.
- **`RegistrarMiFirma`:**
  - comprueba la contraseña; si falla: `422` y auditoría `registrar_rechazada`, sin la contraseña;
  - valida la imagen, la guarda cifrada y la registra;
  - si la base de datos falla, **borra el archivo**.
- `ObtenerMiFirma`, `ObtenerImagenFirma` (`propia` o `deUsuario`; la firma debe ser de ese usuario), `ConsultarFirmasUsuario` y `DesactivarFirma`.
- **Auditoría** (`entidad: firmas_usuarios`): `registrar`, `registrar_rechazada`, `consultar_imagen` y `desactivar` (con el motivo). Nunca la contraseña ni la imagen.
- **Exporta** `FirmasUsuariosRepositorio` y `LectorImagenFirma` para `prehospital_care`.

## Uso en la historia clínica

Ver [historia-clinica.md](historia-clinica.md) → "Firma registrada estampada".
- `CerrarHistoriaClinica` exige una firma vigente; si no la hay, responde `422`, salvo que `FIRMA_CIERRE_OBLIGATORIA=false`.
- Guarda la firma en `firma_cierre_id`, y su huella entra en `hash_cierre`.

## Pruebas

- **Unitarias del módulo (23):**
  - imagen (5);
  - entidad (4);
  - cifrado con disco real en una carpeta temporal (6): ida y vuelta; nada en claro; archivo alterado; archivo copiado encima de otro; rotación; sin clave; rutas ajenas; no sobrescribe;
  - casos de uso (8).
- **Total del proyecto:** 450.
- **Prueba real (2026-11-14), 44/44 sobre una copia de la BD, con el almacenamiento en una carpeta temporal:**
  - roles;
  - `400`, `413` y `422`;
  - la imagen descargada es idéntica a la subida y el archivo en disco va cifrado;
  - cierre sin firma → `422`; con firma, estampa la versión;
  - al cambiar la firma, la historia sigue mostrando la vieja;
  - historial del administrador, desactivar (`200` y luego `422`);
  - concurrencia;
  - un archivo alterado → `500`;
  - los 6 `CHECK` y la FK `RESTRICT` rechazan datos inválidos;
  - la auditoría quedó sin contraseñas.

## Firmas de la historia y modalidad del servicio (fases 2 y 3, 2026-11-15)

**Modalidad del servicio** (migración `20261115191220_modalidad_servicio`):
- `emergencias.modalidad`, `NOT NULL`, por defecto `emergencia`, con `CHECK`. Valores (`MODALIDADES_SERVICIO`): emergencia, accidente de tránsito, traslado programado, traslado entre instituciones, atención en sitio.
- La elige el despachador o el administrador en `POST /emergencias` y `PATCH`, y se filtra con `?modalidad=`. Los reportes de ciudadanos quedan como `emergencia`.
- **No es el tipo de ambulancia** (TAB o TAM).
- La historia no guarda la modalidad: **la lee de su emergencia**, así que si el despachador la corrige, cambia lo que se exige al cerrar.

**Política de firmas** (`domain/politicas_firma.ts`, valores fijos por ahora):

| Modalidad | Comprobante | Receptor (solo si fue trasladado) |
| --- | --- | --- |
| Emergencia, accidente de tránsito, atención en sitio | `si_es_posible` | `opcional` |
| Traslado programado | `obligatoria` | `obligatoria` |
| Traslado entre instituciones | `si_es_posible` | `obligatoria` |

- `obligatoria`: firma con imagen del paciente o del familiar.
- `si_es_posible`: esa firma, o la fila del paciente con el motivo por el que nadie firmó.
- **Disentimiento** (`rechazo_traslado`): siempre obligatorio. Si el paciente `se_nego`, se exige además la firma de un **testigo**.
- **Sin firmas exigidas:** `fallecido_en_sitio`, o mientras no haya desenlace.
- **Dónde se aplica:** `faltantesDeFirmas` entra en `HistoriaClinica.faltantesParaCerrar` cuando `ResumenRegistros.firmas` viene.
  - El detalle siempre las incluye, así la app ve lo que falta.
  - El cierre solo las exige si `FIRMA_CIERRE_OBLIGATORIA` no es `false`, la misma bandera de transición de la firma del profesional.

**Tabla `firmas_historia`** (migración `20261115191441_firmas_historia`):
- Columnas: rol (`paciente`, `acudiente`, `testigo`, `receptor`), propósito (`comprobante_atencion`, `disentimiento`, `entrega`), datos del firmante, imagen (las mismas columnas que `firmas_usuarios`, cifrada en `firmas/`) **o** `motivo_sin_firma`, `texto_version`, `firmada_en` y quién la tomó.
- Única por (historia, propósito, rol): para cambiar una, se quita y se toma de nuevo.
- **6 `CHECK`:**
  - los valores de rol y propósito;
  - el testigo solo firma el disentimiento y el receptor solo la entrega;
  - imagen completa **xor** motivo, y el motivo solo en la fila del paciente;
  - `detalle_motivo` solo con motivo;
  - el acudiente y el testigo con nombre y documento de adulto; el acudiente con parentesco; el receptor con nombre y cargo.
- **La firma del profesional no va aquí:** está en `historias_clinicas.firma_cierre_id`.

**Reglas de `crearFirmaHistoria`** (`domain/entities/firma_historia.ts`):
- **El paciente** firma con **los datos de la historia**: los copia al firmar y exige nombres y documento.
- **El acudiente** debe ser **familiar** (`PARENTESCOS`) y **mayor de edad**: solo CC, CE, PA, PEP o PPT.
- **El testigo**: nombre y documento de adulto.
- **El receptor**: nombre y cargo.
- **El disentimiento** solo se firma con desenlace `rechazo_traslado` y `motivoRechazo`.
- **Motivo `otro`:** requiere el detalle.
- **Fecha:** hasta 60 s en el futuro.
- **Textos** (`TEXTOS_FIRMA`, versión `v1`) de comprobante, disentimiento y entrega: van en `catalogos.textosFirma`, y en cada firma queda la versión aceptada.

**Casos de uso:**
- **`RegistrarFirmaHistoria`:**
  - el id viene del celular: un reenvío devuelve la misma firma y no guarda otra imagen;
  - valida todo **antes** de guardar el archivo, y lo borra si falla la base;
  - un segundo firmante del mismo rol y propósito da `409`.
- **`ObtenerImagenFirmaHistoria`:** para la tripulación y el administrador, auditada (`consultar_firma_historia`).
- **`QuitarFirmaHistoria`:** solo en borrador; borra también la imagen, porque la historia aún no está sellada.
- **Auditoría:** `registrar_firma_<rol>` y `eliminar_firma_<rol>`, con `registroId` y `proposito`. **Nunca nombres ni documentos.**
- **Huella del cierre:** incluye las firmas (datos, huella de la imagen o motivo), solo si hay alguna.
- **Límite de subida:** `limitesSubidaFirma(campos)` (`signatures/presentation`). "Mi firma" admite 5 campos y las firmas de la historia 15: el formulario tiene hasta 11, y con el límite de 5 multer respondía "Too many fields".

**Endpoints** (`FirmasHistoriaController`):
- `POST /historias-clinicas/{id}/firmas`: multipart, con `imagen` opcional, solo el paramédico.
- `GET …/firmas/{firmaId}/imagen`: paramédico y administrador.
- `DELETE …/firmas/{firmaId}`: paramédico.
- El detalle trae `modalidad` y `firmasHistoria`. Los catálogos traen modalidades, políticas, roles, propósitos por rol, parentescos, motivos, documentos de adulto y textos.

**Pruebas:**
- unitarias +13: reglas de cada firmante y política por modalidad (dominio); toma, `409`, testigo exigido y quitar (casos de uso);
- total del proyecto: 478;
- prueba real (2026-11-15), 51/51 sobre una copia de la BD:
  - modalidad: crear, por defecto, inválida, `PATCH`, `null` → `400`, filtro;
  - "emergencia": cierre sin comprobante → `422`, paciente sin datos → `422`, `400`/`422` de combinaciones inválidas, firma, reenvío, `409`, imagen idéntica, `403` a otra tripulación, cierre, no se quita después de cerrar;
  - rechazo: el paciente se niega → testigo menor `422` → testigo → quitar y volver a tomar → cierre;
  - "traslado programado": el motivo no basta, comprobante y receptor exigidos, `422`, `409` y cierre con 3 firmas;
  - consulta por modalidad, trazabilidad con las firmas como tipo `firma`;
  - en la BD: los `CHECK` rechazan datos incoherentes, la auditoría no tiene nombres y las imágenes están cifradas (la quitada, borrada).
- **Corregido de paso:** `PATCH /emergencias` con `fuente: null` o `descripcion: null` respondía 500; ahora `400` (`SiSeEnvia`).

## PDF de la historia (fase 4, 2026-11-15)

- **`GET /historias-clinicas/{id}/pdf`:** para la tripulación y el administrador, auditado como `exportar_pdf`. Responde `application/pdf` con `attachment; filename="HC-….pdf"` y `no-store`.
- **Librería:** `pdfkit` 0.20 (y `@types/pdfkit`), la única dependencia nueva.
  - Puerto `GeneradorPdfHistoria` (`domain/services`) y adaptador `PdfkitGeneradorHistoria` (`infrastructure/services`).
  - Variable `NOMBRE_EMPRESA` (por defecto "Ambulancias Galenos"); en el `.env` va **entre comillas**, porque tiene espacios.
- **`ExportarHistoriaPdf`:**
  - carga el detalle;
  - descifra la firma de cierre (la versión estampada) y las firmas de la historia con `LectorImagenFirma`, que verifica la huella;
  - le pasa al generador los textos aceptados y la declaración del profesional.
- **Contenido** (A4, fuente Helvetica):
  - **encabezado** con la empresa, el número de historia y el ingreso;
  - **franja de aviso** si está en curso o anulada;
  - **secciones:** servicio (con la modalidad), paciente (NN si no está identificado), evento, XABCDE y AMPLE;
  - **tabla de signos vitales**; lesiones, procedimientos y Downton;
  - **diagnóstico y desenlace**;
  - **firmas**: cada una con el texto aceptado, la imagen y los datos; el "no firmó" con su motivo; la del profesional con la declaración, el método y el código de verificación;
  - **pie** en cada página con la historia, el estado, la paginación y quién lo generó.
  - Etiquetas en español (`domain/etiquetas_clinicas.ts`), "Sin dato" para los vacíos y hora de Colombia.
- **Pruebas:** el generador real produce un PDF válido con los textos esperados (decodificando el contenido de `pdfkit`) y las imágenes, y una historia en curso lo advierte; el caso de uso tiene control de acceso y auditoría.

## Pendiente

- **Después:**
  - textos y políticas editables por cada empresa: hoy son constantes;
  - registro profesional (ReTHUS) en la firma.
- **Descartado:** cofirma obligatoria del médico. La norma pide la firma del autor de cada registro, no de toda la tripulación; si el médico dirige la atención, él cierra y firma.
- **Otros:**
  - las fotos de la cédula de los ciudadanos siguen **sin cifrar**: hay que migrar los archivos existentes;
  - una sola instalación por empresa (multiempresa queda fuera).
