# Historia clínica (HC) — guía para la app móvil (Flutter)

**Para:** el equipo de la app de la tripulación (`ambulancia/app`).
**Complementa a:** [`api-app-paramedico.md`](api-app-paramedico.md) (inicio del paramédico) y [`api-ciclo-atencion-app.md`](api-ciclo-atencion-app.md) (pasos del servicio).

Con esto se conecta la pantalla de HC que hoy está vacía. **Esta primera versión es manual** (formularios). El registro por voz (escucha continua) llegará después: no hay que implementar nada de audio todavía.

---

## 1. Reglas que la app debe conocer

| Regla | Detalle |
| --- | --- |
| **Quién** | Solo el **paramédico o médico del turno** del servicio crea y llena la HC. El conductor recibe `403` en todo lo de HC (no ve datos clínicos) |
| **Una HC por paciente** | Un servicio con 2 víctimas tiene 2 historias. Botón "Agregar paciente" |
| **Borrador hasta cerrar** | Se guarda tantas veces como se quiera mientras está en `borrador`. Todo es opcional mientras tanto: en trauma grave primero se atiende y luego se completa |
| **Cerrar = sellar** | Al cerrar, el backend valida lo mínimo y calcula una **huella** del contenido. Desde ahí **no se edita** (`422`). Solo el administrador la puede anular |
| **Sin señal** | La app genera los **ids** (UUID v4) de la HC y de cada registro. Reenviar el mismo id **no duplica**: devuelve lo que ya existe. Se puede trabajar sin conexión y sincronizar después |
| **Número** | El backend asigna `numeroHistoria` (`HC-20261025-0001`). Muéstrelo cuando llegue |
| **Privacidad** | Cada consulta del detalle queda auditada. No guarde la HC en almacenamiento sin cifrar del celular |

---

## 2. Endpoints

Todos con `Authorization: Bearer <token>` del paramédico.

| Método | Ruta | Para qué |
| --- | --- | --- |
| GET | `/historias-clinicas/catalogos` | Valores de los selects (una vez; puede cachearlo) |
| POST | `/historias-clinicas` | Abrir la HC de un paciente |
| GET | `/historias-clinicas?asignacionId={id}` | Pacientes (HC) del servicio actual |
| GET | `/historias-clinicas/{id}` | HC completa + `faltantesParaCerrar` |
| PATCH | `/historias-clinicas/{id}` | Guardar lo que se va llenando |
| POST | `/historias-clinicas/{id}/signos-vitales` | Agregar una toma de signos vitales |
| POST | `/historias-clinicas/{id}/lesiones` | Agregar una lesión |
| POST | `/historias-clinicas/{id}/intervenciones` | Agregar un procedimiento o medicamento |
| DELETE | `/historias-clinicas/{id}/signos-vitales/{registroId}` | Quitar una toma (error de digitación; solo en borrador) |
| DELETE | `/historias-clinicas/{id}/lesiones/{registroId}` | Quitar una lesión |
| DELETE | `/historias-clinicas/{id}/intervenciones/{registroId}` | Quitar una intervención |
| POST | `/historias-clinicas/{id}/cerrar` | Cerrar y sellar |
| GET | `/instituciones-salud?activa=true&latitud=…&longitud=…` | Hospitales de destino, del más cercano al más lejano |

---

## 3. Flujo en la app

```text
Inicio paramédico → tarjeta de la emergencia
        │
        ▼
Lista de pacientes del servicio   (GET /historias-clinicas?asignacionId=)
   ├─ [+ Agregar paciente] → POST /historias-clinicas   (id generado en el celular)
   └─ toca un paciente     → GET /historias-clinicas/{id}
        │
        ▼
Pantalla de HC (secciones)
   ├─ Paciente / Evento / XABCDE / Antecedentes / Desenlace → PATCH (al salir de cada sección o con autoguardado)
   ├─ Signos vitales   → POST …/signos-vitales (una toma cada vez)
   ├─ Lesiones         → POST …/lesiones
   ├─ Intervenciones   → POST …/intervenciones
   └─ [Cerrar HC]      → POST …/cerrar   (habilitado cuando faltantesParaCerrar está vacío)
```

Sugerencias:
- **Autoguardado:** enviar `PATCH` al salir de una sección o 2–3 s después de dejar de escribir, solo con los campos cambiados.
- **Lo que falta:** `faltantesParaCerrar` (viene en cada respuesta de detalle, PATCH y apertura) sirve para marcar en rojo las secciones incompletas y para habilitar "Cerrar HC".
- **Con el ciclo del servicio:** al marcar "Iniciar atención" (`atendiendo`), abra la HC. El hospital de destino y la entrega se llenan cuando la ambulancia llega al destino.

---

## 4. Abrir la HC — `POST /historias-clinicas`

```json
{
  "id": "e4a8fd3e-3d2a-4461-a2f7-9422343863ff",
  "asignacionId": "uuid de asignacion.id en /mi-servicio",
  "abiertaEn": "2026-10-25T19:31:40.000Z"
}
```

- `id` (opcional pero **recomendado**): UUID v4 generado en el celular. Si la respuesta no llega y se reintenta, el backend devuelve la misma historia.
- `abiertaEn` (opcional): hora en que se abrió en el celular (útil si se abrió sin señal).

**201**: la HC completa (sección 9) en `borrador`, con su `numeroHistoria` y `faltantesParaCerrar`.

| Código | Cuándo |
| --- | --- |
| `403` | El usuario no es el paramédico o el médico del turno de ese servicio |
| `404` | La asignación no existe |
| `409` | Ese `id` ya es de una historia de **otro** servicio (generar otro UUID) |
| `422` | Servicio cancelado, o `abiertaEn` en el futuro |

---

## 5. Guardar datos — `PATCH /historias-clinicas/{id}`

Envíe **solo lo que cambió**. `null` borra un dato. Responde **200** con la HC completa.

```json
{
  "pacienteIdentificado": true,
  "nombres": "Juan Carlos",
  "apellidos": "Pérez",
  "tipoDocumento": "CC",
  "numeroDocumento": "1.090.123.456",
  "sexo": "masculino",
  "edadAproximada": 34,
  "tipoEvento": "transito",
  "rolVictima": "motociclista",
  "elementosProteccion": "casco",
  "placaVehiculo": "abc 12d",
  "aViaAerea": "Permeable",
  "cCirculacion": "Pulso radial presente",
  "triage": "amarillo"
}
```

El backend normaliza: documento sin puntos ni guiones (`1090123456`), placa en mayúsculas sin espacios (`ABC12D`) y textos vacíos como `null`.

### Campos por sección

**Paciente**

| Campo | Tipo / valores |
| --- | --- |
| `pacienteIdentificado` | `true` / `false` (`false` = **NN**) |
| `nombres`, `apellidos` | texto ≤ 150 |
| `tipoDocumento` | `CC`, `TI`, `RC`, `CE`, `PA`, `PEP`, `PPT`, `AS` (adulto sin identificación), `MS` (menor sin identificación) |
| `numeroDocumento` | texto ≤ 40 |
| `sexo` | `masculino`, `femenino`, `indeterminado` |
| `edadAproximada` | entero 0–120 |
| `fechaNacimiento` | fecha `AAAA-MM-DD` |
| `aseguradoraEps` | texto ≤ 120 |
| `acompananteNombre` / `acompananteTelefono` | texto ≤ 150 / ≤ 30 |

**Evento**

| Campo | Tipo / valores |
| --- | --- |
| `horaEvento` | fecha y hora ISO |
| `tipoEvento` | `transito`, `caida`, `arma_fuego`, `arma_blanca`, `quemadura`, `clinico`, `otro` |
| `mecanismoLesion` | texto libre (≤ 5000) |
| `rolVictima` (solo tránsito) | `conductor`, `pasajero`, `peaton`, `motociclista`, `ciclista` |
| `elementosProteccion` | texto ≤ 100 (por ejemplo, "casco", "cinturón", "ninguno") |
| `placaVehiculo` / `polizaSoat` | texto ≤ 20 / ≤ 60 (para el SOAT) |

**Valoración primaria XABCDE** (textos ≤ 255)

`xHemorragiaMasiva`, `aViaAerea`, `bRespiracion`, `cCirculacion`, `dNeurologico` (pupilas, focalización; el Glasgow va en signos vitales), `eExposicion`, y **`triage`**: `rojo`, `amarillo`, `verde`, `negro`.

**Antecedentes e impresión**

`alergias`, `medicamentosHabituales`, `antecedentes` (≤ 255); `impresionDiagnostica`, `observaciones` (≤ 5000).

**Desenlace y entrega**

| Campo | Tipo / valores |
| --- | --- |
| `desenlace` | `trasladado`, `rechazo_traslado`, `atendido_en_sitio`, `fallecido_en_sitio` |
| `motivoRechazo` | texto (obligatorio para cerrar si `rechazo_traslado`) |
| `institucionDestinoId` | id de `GET /instituciones-salud` (activa) |
| `condicionEntrega` | texto (≤ 5000) |
| `receptorNombre` / `receptorCargo` | texto ≤ 150 / ≤ 100 |
| `entregadoEn` | fecha y hora ISO (si no se envía, al cerrar se pone la hora del cierre) |

> La **firma del rechazo** (imagen) llegará en una versión siguiente. Por ahora solo `motivoRechazo`.

| Código | Cuándo |
| --- | --- |
| `400` | Valor fuera del catálogo o del rango (por ejemplo, "sexo must be one of the following values…") |
| `409` | Otro dispositivo la modificó al mismo tiempo: recargue el detalle |
| `422` | La HC ya está `cerrada` o `anulada`, o la institución de destino no existe o está inactiva |

---

## 6. Signos vitales, lesiones e intervenciones

Son **listas**: cada toma o registro es un `POST` aparte. Envíe un `id` (UUID del celular) en cada uno: reenviarlo no duplica.

### Signos vitales — `POST /historias-clinicas/{id}/signos-vitales`

```json
{
  "id": "uuid del celular",
  "medidoEn": "2026-10-25T19:35:00.000Z",
  "presionSistolica": 118, "presionDiastolica": 76,
  "frecuenciaCardiaca": 102, "frecuenciaRespiratoria": 20,
  "saturacionOxigeno": 95, "temperatura": 36.4, "glucometria": 110,
  "glasgowOcular": 4, "glasgowVerbal": 5, "glasgowMotor": 6,
  "escalaDolor": 7
}
```

| Campo | Rango |
| --- | --- |
| `presionSistolica` / `presionDiastolica` | 0–300 / 0–250 (la diastólica debe ser menor) |
| `frecuenciaCardiaca` | 0–300 |
| `frecuenciaRespiratoria` | 0–80 |
| `saturacionOxigeno` | 0–100 |
| `temperatura` | 25–45 (1 decimal) |
| `glucometria` | 0–1000 mg/dL |
| `glasgowOcular` / `glasgowVerbal` / `glasgowMotor` | 1–4 / 1–5 / 1–6 |
| `escalaDolor` | 0–10 |

Todo es opcional, pero debe venir **al menos una medición**. `medidoEn` por defecto es "ahora". **`glasgowTotal` lo calcula el backend** cuando vienen las tres partes. **201**: la toma con `glasgowTotal` y `registradoPor`.

Errores: `400` fuera de rango (por ejemplo, "frecuenciaCardiaca must not be greater than 300"); `422` sin mediciones o diastólica ≥ sistólica.

### Lesiones — `POST /historias-clinicas/{id}/lesiones`

```json
{ "id": "uuid", "regionCorporal": "miembro_inferior_derecho", "tipoLesion": "fractura", "descripcion": "Deformidad en tibia" }
```

- `regionCorporal`: `cabeza`, `cara`, `cuello`, `torax`, `abdomen`, `espalda`, `pelvis`, `miembro_superior_derecho`, `miembro_superior_izquierdo`, `miembro_inferior_derecho`, `miembro_inferior_izquierdo`, `generalizada`. Sugerencia: un **dibujo del cuerpo** donde se toca la región.
- `tipoLesion`: `herida`, `fractura`, `quemadura`, `amputacion`, `contusion`, `luxacion`, `trauma_cerrado`, `otra`.

### Intervenciones — `POST /historias-clinicas/{id}/intervenciones`

```json
{ "id": "uuid", "tipo": "medicamento", "nombre": "SSN 0.9%", "dosis": "500 ml", "via": "intravenosa", "realizadoEn": "2026-10-25T19:40:00.000Z", "resultado": "Tolera" }
```

- `tipo`: `procedimiento` (inmovilización, oxígeno, canalización, torniquete…) o `medicamento`.
- `nombre` es obligatorio (2–150). `dosis`, `via`, `resultado` y `realizadoEn` son opcionales; `realizadoEn` por defecto es "ahora".

### Quitar un registro (error de digitación)

`DELETE /historias-clinicas/{id}/signos-vitales/{registroId}` (y lo mismo con `lesiones` o `intervenciones`) → **204**. Solo en borrador. Queda en la auditoría. `404` si no existe.

---

## 7. Cerrar la HC — `POST /historias-clinicas/{id}/cerrar`

Sin cuerpo. Habilite el botón cuando `faltantesParaCerrar` venga vacío. Muestre una confirmación: *"Después de cerrar no podrá modificarla"*.

Lo que exige el backend:

| Siempre | Según el caso |
| --- | --- |
| `triage` | Si `pacienteIdentificado` → `nombres` o `numeroDocumento` |
| `desenlace` | Si `trasladado` → `institucionDestinoId` y `receptorNombre` |
| Al menos **una toma de signos vitales** (salvo `fallecido_en_sitio`) | Si `rechazo_traslado` → `motivoRechazo` |

**200**: la HC con `estado: "cerrada"`, `cerradaEn`, `cerradaPor` y `hashCierre`.
**422**: "Para cerrar la historia falta: desenlace, …" (los mismos textos de `faltantesParaCerrar`).

---

## 8. Lista de pacientes — `GET /historias-clinicas?asignacionId={id}`

```json
[
  { "id": "uuid", "numeroHistoria": "HC-20261025-0001", "estado": "cerrada", "numeroEmergencia": "EMG-20261025-0002",
    "paciente": "Juan Carlos Pérez", "triage": "amarillo", "desenlace": "trasladado",
    "abiertaEn": "…", "cerradaEn": "…" }
]
```

`paciente` es `"NN"` mientras no esté identificado. Úselo en la lista con el color del triage y el estado (borrador / cerrada).

---

## 9. HC completa (respuesta de detalle, apertura, PATCH y cierre)

```json
{
  "id": "uuid",
  "numeroHistoria": "HC-20261025-0001",
  "estado": "borrador",
  "emergenciaId": "uuid",
  "numeroEmergencia": "EMG-20261025-0002",
  "asignacionId": "uuid",
  "abiertaEn": "…", "cerradaEn": null, "sincronizadaEn": "…",
  "creadaPor": { "id": "uuid", "nombreCompleto": "Lucía Rojas" },
  "cerradaPor": null,
  "hashCierre": null,
  "institucionDestino": { "id": "uuid", "nombre": "Hospital Erasmo Meoz" },
  "datos": { "pacienteIdentificado": true, "nombres": "Juan Carlos", "…": "los mismos campos del PATCH" },
  "signosVitales": [ { "id": "uuid", "medidoEn": "…", "presionSistolica": 118, "…": "…", "glasgowTotal": 15, "registradoPor": { "id": "uuid", "nombreCompleto": "Lucía Rojas" } } ],
  "lesiones": [ { "id": "uuid", "regionCorporal": "miembro_inferior_derecho", "tipoLesion": "fractura", "descripcion": "Deformidad en tibia" } ],
  "intervenciones": [ { "id": "uuid", "tipo": "procedimiento", "nombre": "Inmovilización con férula", "dosis": null, "via": null, "realizadoEn": "…", "resultado": null, "registradoPor": { "…": "…" } } ],
  "faltantesParaCerrar": ["desenlace"]
}
```

`datos` tiene **exactamente los mismos campos** que el `PATCH`: el formulario se puede llenar y guardar con el mismo modelo.

---

## 10. Sin señal (cómo sincronizar sin duplicar)

1. Genere los UUID en el celular para la HC y para cada signo, lesión e intervención.
2. Guarde las operaciones pendientes en una cola local cifrada, en orden.
3. Al volver la señal, envíelas **en orden**: primero `POST /historias-clinicas`, después los `PATCH` y los `POST` de registros.
4. Si una respuesta no llegó, **reenvíe la misma operación con el mismo id**: no se duplica.
5. Envíe `abiertaEn` y `medidoEn` / `realizadoEn` con las horas reales del celular.
6. No intente cerrar sin señal: el cierre necesita que el servidor tenga todo.

---

## 11. Modelos Dart sugeridos

```dart
class HistoriaClinica {
  final String id, numeroHistoria, estado; // borrador | cerrada | anulada
  final String emergenciaId;
  final String? numeroEmergencia, asignacionId, hashCierre;
  final DateTime abiertaEn;
  final DateTime? cerradaEn;
  final Persona creadaPor;
  final Persona? cerradaPor;
  final ({String id, String? nombre})? institucionDestino;
  final DatosHistoria datos; // mismo modelo que se envía en PATCH
  final List<SignoVital> signosVitales;
  final List<Lesion> lesiones;
  final List<Intervencion> intervenciones;
  final List<String> faltantesParaCerrar;
  bool get editable => estado == 'borrador';
  bool get sePuedeCerrar => editable && faltantesParaCerrar.isEmpty;
}

class DatosHistoria {
  bool pacienteIdentificado;
  String? nombres, apellidos, tipoDocumento, numeroDocumento, sexo, aseguradoraEps,
      acompananteNombre, acompananteTelefono, tipoEvento, mecanismoLesion, rolVictima,
      elementosProteccion, placaVehiculo, polizaSoat, xHemorragiaMasiva, aViaAerea,
      bRespiracion, cCirculacion, dNeurologico, eExposicion, triage, alergias,
      medicamentosHabituales, antecedentes, impresionDiagnostica, observaciones, desenlace,
      motivoRechazo, institucionDestinoId, condicionEntrega, receptorNombre, receptorCargo;
  int? edadAproximada;
  DateTime? fechaNacimiento, horaEvento, entregadoEn;
}
```

Use `GET /historias-clinicas/catalogos` para llenar los selects. Así, si se agrega un valor, la app no queda desactualizada.

---

## 12. Resumen

| Pantalla | Consume |
| --- | --- |
| Lista de pacientes del servicio | `GET /historias-clinicas?asignacionId=` |
| Agregar paciente | `POST /historias-clinicas` (id del celular) |
| Formulario por secciones | `GET /historias-clinicas/{id}` + `PATCH` |
| Signos vitales / lesiones / intervenciones | `POST` (y `DELETE` para corregir) |
| Hospital de destino | `GET /instituciones-salud?activa=true&latitud=&longitud=` |
| Cerrar | `POST /historias-clinicas/{id}/cerrar` |
| Selects | `GET /historias-clinicas/catalogos` |
