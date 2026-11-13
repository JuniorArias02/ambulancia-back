# API para la app móvil (Flutter) — login e inicio

**Para:** el equipo de la app de la tripulación (carpeta `ambulancia/app`).
**Alcance de esta entrega:** iniciar sesión, mantener la sesión, la pantalla de inicio (el servicio asignado en el mapa) y **enviar la ubicación GPS** para que la central vea la ambulancia en vivo. El avance del servicio y el tiempo real se documentan al final como "siguiente paso".

---

> **Cambio (2026-11-01):** el despachador ya no asigna la ambulancia: `turno: null` significa que el usuario debe seleccionarla. Ver [`instrucciones-agente-flutter.md`](instrucciones-agente-flutter.md).

## 1. Conexión con el backend

| Dónde corre la app | Base URL |
| --- | --- |
| Emulador Android | `http://10.0.2.2:3000/api/v1` (10.0.2.2 es el `localhost` del PC) |
| Simulador iOS | `http://localhost:3000/api/v1` |
| Celular físico (misma red Wi-Fi) | `http://<IP del PC>:3000/api/v1`, por ejemplo `http://192.168.1.50:3000/api/v1` |

- Deje la base URL en la configuración (`app/config`), nunca escrita en el código de cada pantalla.
- Android bloquea `http://` por defecto. En desarrollo, habilite el tráfico sin cifrar solo para esa IP (`network_security_config.xml`). En producción será `https://`.
- Swagger para ver y probar todo: `http://<host>:3000/api/docs`.

### Reglas generales

- Todas las rutas, menos el login, llevan el encabezado `Authorization: Bearer <tokenAcceso>`.
- Fechas en ISO 8601 UTC (`2026-10-24T14:30:00.000Z`): conviértalas a la hora local para mostrarlas.
- Formato de error, igual en todos los endpoints:

```json
{
  "codigoEstado": 401,
  "error": "UNAUTHORIZED",
  "mensaje": "Credenciales inválidas",
  "ruta": "/api/v1/autenticacion/iniciar-sesion",
  "fecha": "2026-10-24T19:13:52.000Z"
}
```

En los errores `400` (validación), `mensaje` es una **lista** de textos.

---

## 2. Quién puede usar la app

La app es **solo para la tripulación**:

| `rol` | ¿Entra a la app? |
| --- | --- |
| `conductor` | ✅ |
| `paramedico` | ✅ |
| `administrador`, `despachador` | ❌ Usan la plataforma web |

El login es el mismo para todos los roles. **La app debe revisar el `rol` de la respuesta.** Si no es `conductor` ni `paramedico`:
1. Llame a `POST /autenticacion/cerrar-sesion` con ese token, para no dejar una sesión abierta.
2. Borre el token.
3. Muestre: *"Esta aplicación es solo para el personal de ambulancias. Ingrese por la plataforma web."*

El backend también protege los datos: un administrador o despachador recibe `403` en los endpoints de la app (`/mi-servicio`), y la tripulación recibe `403` en los de la web.

---

## 3. Iniciar sesión — `POST /autenticacion/iniciar-sesion`

Pública (sin token).

```json
{ "correo": "pedro.conductor@prueba.co", "contrasena": "Prueba2026x" }
```

**200**
```json
{
  "tokenAcceso": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…",
  "tipoToken": "Bearer",
  "expiraEn": "2026-10-25T03:13:52.000Z",
  "usuario": {
    "id": "4b80ce32-a550-4c7d-9089-0edc24184b3f",
    "nombres": "Pedro",
    "apellidos": "Díaz",
    "correo": "pedro.conductor@prueba.co",
    "rol": "conductor"
  }
}
```

| Código | Cuándo | Qué mostrar |
| --- | --- | --- |
| `400` | Falta el correo o la contraseña, o el correo no es válido | Los mensajes de `mensaje` en los campos |
| `401` | "Credenciales inválidas" | Ese mismo texto. Es igual si el correo no existe, si la contraseña está mal o si el usuario está bloqueado o inactivo (por seguridad no se distingue) |
| `429` | Más de 5 intentos por minuto desde el mismo dispositivo | "Demasiados intentos. Espere un minuto." |

### Guardar la sesión

- Guarde `tokenAcceso`, `expiraEn` y `usuario` en almacenamiento **seguro** (`flutter_secure_storage`), nunca en `SharedPreferences`.
- El token dura **8 horas** (un turno). Cuando pase `expiraEn`, mande al login sin llamar al backend.
- No hay *refresh token*: al vencer, se inicia sesión de nuevo.

---

## 4. Al abrir la app — `GET /autenticacion/perfil`

Si hay un token guardado y no ha vencido, valídelo con este endpoint antes de entrar:

**200**: el mismo objeto `usuario` del login. Úselo para refrescar el nombre y el rol.

**401** ("Sesión inválida o expirada"): borre el token y vaya al login. Pasa cuando:
- el usuario cerró sesión en otro lado o cambió su contraseña;
- un administrador lo bloqueó o lo inactivó;
- el token venció.

**Regla para toda la app:** cualquier `401` en cualquier endpoint significa lo mismo: borrar la sesión e ir al login. Resuélvalo en un solo lugar (un interceptor de Dio, por ejemplo).

---

## 5. Cerrar sesión — `POST /autenticacion/cerrar-sesion`

Sin cuerpo, con el token. **204** sin contenido. El token deja de servir de inmediato. Después, borre el almacenamiento local y vaya al login. Si responde `401`, igual borre todo: la sesión ya no existía.

---

## 6. Pantalla de inicio — `GET /mi-servicio`

**Un solo endpoint para el conductor y el paramédico.** Devuelve el turno del tripulante, el servicio que tiene asignado ahora su ambulancia y la emergencia que debe atender.

**200** (con un servicio asignado):
```json
{
  "turno": {
    "id": "uuid",
    "ambulanciaId": "uuid",
    "ambulanciaCodigo": "AMB-01",
    "inicio": "2026-10-24T13:00:00.000Z",
    "fin": null,
    "estado": "activo",
    "integrantes": [
      { "usuarioId": "uuid", "nombreCompleto": "Pedro Díaz", "funcion": "conductor" },
      { "usuarioId": "uuid", "nombreCompleto": "Ana Rojas", "funcion": "paramedico" }
    ]
  },
  "asignacion": {
    "id": "uuid",
    "emergenciaId": "uuid",
    "numeroEmergencia": "EMG-20261024-0004",
    "ambulanciaId": "uuid",
    "ambulanciaCodigo": "AMB-01",
    "turnoId": "uuid",
    "estado": "asignada",
    "siguientesEstados": ["en_camino"],
    "motivoCancelacion": null,
    "asignadaPor": { "id": "uuid", "nombreCompleto": "Laura Gómez" },
    "asignadaEn": "2026-10-24T14:30:00.000Z",
    "salidaEn": null,
    "llegadaEscenaEn": null,
    "salidaEscenaEn": null,
    "llegadaDestinoEn": null,
    "finalizadaEn": null
  },
  "emergencia": {
    "id": "uuid",
    "numeroEmergencia": "EMG-20261024-0004",
    "fuente": "linea_123",
    "informanteNombre": "Carlos Ruiz",
    "informanteTelefono": "+57 300 123 4567",
    "descripcion": "Choque de moto en la 80, motociclista consciente",
    "tipoIncidente": "accidente_transito",
    "prioridad": "roja",
    "direccion": "Calle 80 # 30-10",
    "referenciaLugar": "Frente a la estación de gasolina",
    "coordenadas": { "latitud": 4.69, "longitud": -74.07 },
    "numeroVictimas": 2,
    "estado": "despachada",
    "emergenciaPrincipalId": null,
    "recibidaPor": { "id": "uuid", "nombreCompleto": "Laura Gómez" },
    "recibidaEn": "2026-10-24T14:28:00.000Z",
    "cerradaEn": null
  }
}
```

### Los tres estados de la pantalla

| `turno` | `asignacion` | Qué mostrar |
| --- | --- | --- |
| `null` | `null` | **"No está en un turno activo."** El despachador debe asignarlo a una ambulancia. No muestre el mapa de servicio |
| con datos | `null` | **"En turno en AMB-01, sin servicio asignado."** Mapa con la posición propia, a la espera. Muestre la tripulación (`turno.integrantes`) |
| con datos | con datos | **Servicio asignado**: el mapa con la emergencia (ver abajo) |

### El mapa con el servicio asignado (conductor y paramédico)

- **Marcador de la emergencia** en `emergencia.coordenadas`, con el color de la `prioridad`:

  | `prioridad` | Color | Texto |
  | --- | --- | --- |
  | `roja` | rojo | Crítica |
  | `amarilla` | amarillo | Urgente |
  | `verde` | verde | No urgente |
  | `null` | gris | Sin clasificar |

- **Ruta**: la traza la app (Google Maps, Mapbox u OSRM), desde la posición del celular hasta `emergencia.coordenadas`. El backend no calcula rutas. Para el conductor, ofrezca además el botón **"Abrir en Google Maps / Waze"**.
- Si `coordenadas` es `null` (solo hay dirección): muestre `direccion` y `referenciaLugar` en grande y abra el navegador externo buscando el texto de la dirección.
- **Tarjeta del servicio**:
  - `numeroEmergencia`, `tipoIncidente`, `descripcion`, `numeroVictimas`;
  - `direccion` + `referenciaLugar`;
  - el botón **Llamar al informante** (`informanteTelefono`) si viene;
  - el estado de la asignación.

Textos para `tipoIncidente`:

| Valor | Texto |
| --- | --- |
| `accidente_transito` | Accidente de tránsito |
| `caida` | Caída |
| `arma` | Herida por arma |
| `quemadura` | Quemadura |
| `clinico` | Caso clínico |
| `otro` | Otro |
| `null` | Sin clasificar |

Textos para `asignacion.estado`:

| Valor | Texto |
| --- | --- |
| `asignada` | Asignada |
| `en_camino` | En camino |
| `en_escena` | En la escena |
| `trasladando` | Trasladando paciente |
| `finalizada` | Finalizada |
| `cancelada` | Cancelada |

### Por qué no aparecen "todos los accidentes"

La tripulación ve **solo el servicio asignado a su ambulancia**: una emergencia a la vez (una ambulancia no puede tener dos servicios activos). Es una regla de seguridad y protección de datos: la lista completa de emergencias, con datos de pacientes e informantes, es del despachador. Por eso `GET /emergencias` responde `403` a conductores y paramédicos.

### Mantener la pantalla al día

- Llame a `GET /mi-servicio` **al abrir la app**, **al volver a primer plano** y **al recuperar la conexión**.
- Mientras llega el tiempo real (sección 8), refresque cada **15 segundos** solo con la pantalla de inicio visible, para enterarse de un servicio nuevo o de una cancelación.
- Si el servicio pasa a `cancelada`, o en la siguiente consulta `asignacion` llega en `null`, avise con un mensaje claro ("El servicio fue cancelado por la central") y vuelva al estado "sin servicio".

| Código | Cuándo | Qué hacer |
| --- | --- | --- |
| `401` | Sesión inválida | Al login (regla general) |
| `403` | El usuario no es conductor ni paramédico | No debería pasar si filtró el rol en el login: cerrar sesión |

---

## 7. Enviar la ubicación (GPS) — `POST /ubicaciones` ⚠️ obligatorio

**Sin esto, la central no ve dónde está la ambulancia.** El mapa de la app muestra la posición leyendo el GPS del propio celular, pero la web solo conoce lo que el celular **le envía a la API**. Si la app no lo envía, la web muestra la última posición guardada, aunque sea de otro día o de otra ciudad. Eso fue lo que pasó en la prueba del 2026-10-24: la app estaba en Cúcuta y la web la mostraba en Bogotá, porque la app nunca había enviado su ubicación.

### Cómo llega a la web en tiempo real (ya funciona en el backend)

```text
Celular ── POST /ubicaciones ──► API (guarda) ──► servidor de tiempo real ──► web: el marcador se mueve
                                  └► ultimaUbicacion de la ambulancia (GET /ambulancias)
```

Probado de punta a punta: desde el `POST` del celular hasta que el evento llega al mapa web pasaron **80 ms**. La app no necesita WebSocket para **enviar**: es un `POST` normal.

### Solicitud

```http
POST /api/v1/ubicaciones
Authorization: Bearer <tokenAcceso>
Content-Type: application/json

{ "latitud": 7.8939, "longitud": -72.5078, "velocidad": 30.5, "registradaEn": "2026-10-24T23:34:30.098Z" }
```

| Campo | Regla | De dónde sale en Geolocator |
| --- | --- | --- |
| `latitud` | Obligatoria, -90 a 90, **máximo 7 decimales** | `posicion.latitude`, redondeada |
| `longitud` | Obligatoria, -180 a 180, **máximo 7 decimales** | `posicion.longitude`, redondeada |
| `velocidad` | Opcional, en **km/h**, de 0 a 400, máximo 2 decimales | `posicion.speed` viene en **m/s**: multiplicar por 3.6. Si es negativa (desconocida), no la envíe |
| `registradaEn` | Opcional, ISO 8601. Hasta 60 s en el futuro (relojes adelantados) | `posicion.timestamp.toUtc().toIso8601String()` |

> ⚠️ **Redondee a 7 decimales.** Geolocator entrega 14 o más (`7.893912345678912`) y el backend responde **`400`** a cada envío si no se redondea: `double.parse(valor.toStringAsFixed(7))`.

**201**
```json
{ "id": "uuid", "ambulanciaId": "uuid", "asignacionId": "uuid", "latitud": 7.8939, "longitud": -72.5078, "velocidad": 30.5, "registradaEn": "2026-10-24T23:34:30.098Z" }
```

- No hay que enviar `ambulanciaId`: el backend la toma del **turno activo** de quien inicia sesión (así nadie puede reportar una ambulancia en la que no va).
- `asignacionId` lo llena el backend si la ambulancia tiene un servicio en curso; con eso se dibuja el recorrido del servicio en la web.

| Código | Cuándo | Qué hacer |
| --- | --- | --- |
| `400` | Más de 7 decimales, fuera de rango o velocidad negativa | Corregir el redondeo (es un error de la app, no del usuario) |
| `401` | Sesión inválida | Al login (regla general) |
| `403` | El usuario no es conductor ni paramédico | No debería pasar |
| `422` | "No está en un turno activo…" o fecha en el futuro | **Dejar de enviar** hasta que `GET /mi-servicio` traiga un `turno` |
| `429` | Demasiadas solicitudes (límite general: 120 por minuto por dispositivo) | Esperar y espaciar los envíos |

### Cuándo enviar

1. **Solo con turno activo**, es decir, cuando `GET /mi-servicio` trae `turno` distinto de `null`. Sin turno, no envíe (el backend respondería `422`).
2. **Frecuencia:** como mínimo cada **5 segundos**, o cuando se mueva **10 metros** (el `distanceFilter` que ya usan), lo que pase **más tarde**. Con la ambulancia quieta, envíe igual **una vez por minuto**, para que la central sepa que sigue conectada. La web pinta en gris las posiciones de más de 10 minutos.
3. **Precisión:** descarte las lecturas con `posicion.accuracy > 50` metros (GPS sin fijar todavía, dentro de un edificio).
4. **Envíelo tanto el conductor como el paramédico.** Basta con que lo haga uno, pero si los dos lo hacen no hay problema: gana la posición más reciente.
5. **En segundo plano:** con la pantalla apagada o la app minimizada, el envío debe continuar mientras haya un servicio en curso. En Android eso requiere un *foreground service* con una notificación visible ("Compartiendo ubicación con la central"). Configure `ForegroundNotificationConfig` en `AndroidSettings` de Geolocator y pida el permiso de ubicación "todo el tiempo".

### Sin señal

- Si el `POST` falla por red, **guarde la posición en una cola local** (con su `registradaEn` original) y reintente en orden cuando vuelva la conexión.
- El backend guarda todas las posiciones para el recorrido, pero **solo mueve el marcador si la posición es más nueva** que la que ya tiene. Las atrasadas no hacen retroceder la ambulancia en el mapa.
- Limite la cola a unas **500 posiciones** (descarte las más viejas) para no llenar el teléfono.

### Ejemplo (Dart, ilustrativo)

```dart
class ReportadorUbicacion {
  ReportadorUbicacion(this._cliente);
  final Dio _cliente;
  DateTime _ultimoEnvio = DateTime.fromMillisecondsSinceEpoch(0);
  StreamSubscription<Position>? _suscripcion;

  static const _intervaloMinimo = Duration(seconds: 5);
  static const _latido = Duration(minutes: 1);

  /// Llamar cuando GET /mi-servicio trae turno; detener cuando llega turno == null.
  void iniciar() {
    _suscripcion ??= Geolocator.getPositionStream(
      locationSettings: AndroidSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 10,
        intervalDuration: _intervaloMinimo,
        foregroundNotificationConfig: const ForegroundNotificationConfig(
          notificationTitle: 'Ambulancias Galenos',
          notificationText: 'Compartiendo ubicación con la central',
          enableWakeLock: true,
        ),
      ),
    ).listen(_alRecibir);
  }

  Future<void> detener() async {
    await _suscripcion?.cancel();
    _suscripcion = null;
  }

  Future<void> _alRecibir(Position posicion) async {
    if (posicion.accuracy > 50) return;
    final ahora = DateTime.now();
    if (ahora.difference(_ultimoEnvio) < _intervaloMinimo) return;
    _ultimoEnvio = ahora;

    double redondear(double v) => double.parse(v.toStringAsFixed(7));
    final cuerpo = <String, dynamic>{
      'latitud': redondear(posicion.latitude),
      'longitud': redondear(posicion.longitude),
      if (posicion.speed >= 0) 'velocidad': double.parse((posicion.speed * 3.6).toStringAsFixed(2)),
      'registradaEn': posicion.timestamp.toUtc().toIso8601String(),
    };

    try {
      await _cliente.post('/ubicaciones', data: cuerpo);
    } on DioException catch (e) {
      final codigo = e.response?.statusCode;
      if (codigo == 422) return detener();      // sin turno activo
      if (codigo == null) _encolar(cuerpo);       // sin señal: reintentar luego, en orden
      // 401 lo maneja el interceptor general (ir al login)
    }
  }

  void _encolar(Map<String, dynamic> cuerpo) { /* cola local, máximo 500 */ }
}
```

> El "latido" de una vez por minuto con la ambulancia quieta se resuelve con un `Timer.periodic(_latido, …)` que envíe la última posición conocida con su `registradaEn` actual.

### Cómo comprobar que funciona

1. Inicie sesión en la app con un tripulante que tenga **turno activo**.
2. En la web, abra el mapa de ambulancias. El marcador debe aparecer donde está el celular en unos segundos y moverse al caminar.
3. En Swagger: `GET /ambulancias` → `ultimaUbicacion.registradaEn` debe ser de hace pocos segundos.

---

## 8. Modelos Dart sugeridos

```dart
class Sesion {
  final String tokenAcceso;
  final DateTime expiraEn;
  final Usuario usuario;
  bool get vencida => DateTime.now().isAfter(expiraEn);
}

class Usuario {
  final String id, nombres, apellidos, correo;
  final String rol; // conductor | paramedico (otros roles no entran)
  bool get esTripulacion => rol == 'conductor' || rol == 'paramedico';
}

class MiServicio {
  final Turno? turno;
  final Asignacion? asignacion;
  final Emergencia? emergencia;
}

class Turno {
  final String id, ambulanciaId, estado;
  final String? ambulanciaCodigo;
  final DateTime inicio;
  final List<Integrante> integrantes; // usuarioId, nombreCompleto, funcion
}

class Asignacion {
  final String id, emergenciaId, ambulanciaId, estado;
  final String? numeroEmergencia, ambulanciaCodigo, motivoCancelacion;
  final List<String> siguientesEstados;
  final DateTime asignadaEn;
  final DateTime? salidaEn, llegadaEscenaEn, salidaEscenaEn, llegadaDestinoEn, finalizadaEn;
}

class Emergencia {
  final String id, numeroEmergencia, descripcion, estado;
  final String? tipoIncidente, prioridad, direccion, referenciaLugar;
  final String? informanteNombre, informanteTelefono;
  final Coordenadas? coordenadas; // latitud, longitud
  final int? numeroVictimas;
  final DateTime recibidaEn;
}
```

Todos los campos marcados con `?` pueden llegar en `null`: no asuma que vienen.

---

## 9. Siguiente paso (ya existe en el backend, para la próxima entrega)

| Funcionalidad | Endpoint | Documentado en |
| --- | --- | --- |
| Ciclo de atención: Salimos → **Llegué (solo el conductor, con GPS)** → Atendiendo → Paciente a bordo → Entregado | `PATCH /asignaciones/{id}/avance` + `GET /asignaciones/{id}/eventos` | **`api-ciclo-atencion-app.md`** |
| Elegir el hospital de destino, del más cercano al más lejano | `GET /instituciones-salud?activa=true&latitud=…&longitud=…` | `api-despacho-frontend.md` §6 |
| Dibujar la ruta hasta la emergencia (la calcula el backend) | `GET /asignaciones/{asignacion.id}/ruta` + evento `asignacion.ruta_actualizada` | `api-rutas-frontend.md` |
| Tiempo real: el servicio llega solo, sin refrescar | Socket.IO, evento `mi_servicio.actualizado` (la misma forma que `GET /mi-servicio`) | `api-tiempo-real-frontend.md` §6 (Flutter) |

**Pendiente en el backend:** la historia clínica del paramédico.

---

## 10. Usuarios de prueba (BD local de desarrollo)

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Conductor | `pedro.conductor@prueba.co` | `Prueba2026x` |
| Paramédico | `ana.paramedica@prueba.co` | `Prueba2026x` |

Para ver un servicio en `GET /mi-servicio`, alguien en la web debe:
1. iniciar un turno de AMB-01 con estos dos usuarios;
2. pasar la ambulancia a disponible;
3. registrar una emergencia;
4. despacharle AMB-01.

Sin turno, la respuesta es `{ "turno": null, "asignacion": null, "emergencia": null }`.

---

## 11. Resumen

| Método | Ruta | Uso en la app |
| --- | --- | --- |
| POST | `/autenticacion/iniciar-sesion` | Login del **personal**. Los ciudadanos reciben `401`: usan `/autenticacion/iniciar-sesion-ciudadano` |
| GET | `/autenticacion/perfil` | Validar la sesión guardada al abrir |
| POST | `/autenticacion/cerrar-sesion` | Cerrar sesión |
| GET | `/mi-servicio` | Pantalla de inicio: turno, servicio asignado y emergencia en el mapa |
| POST | `/ubicaciones` | **Enviar el GPS** cada 5 s o 10 m mientras haya turno activo (la central ve la ambulancia en vivo) |
