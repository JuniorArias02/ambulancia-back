# Reglas de desarrollo Backend — Ambulancias Galenos

## 1. Objetivo del proyecto

Desarrollar el backend de **Ambulancias Galenos**, una API segura, modular y mantenible para gestionar emergencias, ambulancias, asignaciones de servicios, seguimiento por GPS, personal prehospitalario, historias de atención y comunicación en tiempo real con la plataforma web.

El backend debe seguir principios de código limpio, separación de responsabilidades, arquitectura hexagonal y desarrollo orientado a casos de uso.

Antes de modificar o crear código, analiza la estructura existente del proyecto y respeta las decisiones arquitectónicas ya establecidas. No reemplaces implementaciones funcionales ni cambies tecnologías sin una razón técnica justificada.

## 2. Stack tecnológico obligatorio

- **NestJS:** framework principal del backend.
- **TypeScript:** lenguaje de programación, con tipado estricto.
- **Prisma ORM:** acceso a la base de datos y gestión del esquema.
- **MySQL:** motor de base de datos, salvo que el proyecto existente establezca una decisión diferente.
- **JWT:** autenticación mediante tokens.
- **Passport:** integración con las estrategias de autenticación de NestJS cuando corresponda.
- **class-validator y class-transformer:** validación y transformación de DTO.
- **Swagger / OpenAPI:** documentación de los endpoints.
- **WebSockets con Socket.IO o la solución ya adoptada:** comunicación en tiempo real para ubicación de ambulancias, asignaciones y actualizaciones de emergencias.
- **Docker:** entorno reproducible cuando esté contemplado en el proyecto.

Usa versiones compatibles entre sí y respeta las dependencias existentes. No instales librerías adicionales si las herramientas actuales permiten resolver el problema correctamente.

## 3. Convenciones de idioma y nomenclatura

**Todas las carpetas técnicas deben nombrarse en inglés y todo el código propio del negocio debe escribirse en español.**

Esta regla aplica a módulos, archivos, clases, variables, métodos, propiedades, interfaces, DTO, entidades y casos de uso.

### Carpetas en inglés

Ejemplos:

- `modules/`
- `domain/`
- `application/`
- `infrastructure/`
- `presentation/`
- `entities/`
- `repositories/`
- `use-cases/`
- `controllers/`
- `services/`
- `dto/`
- `guards/`
- `strategies/`
- `decorators/`
- `exceptions/`
- `config/`
- `common/`
- `database/`

Los nombres técnicos exigidos por NestJS, Prisma o las herramientas utilizadas pueden conservar sus convenciones oficiales cuando sea necesario.

### Archivos y código en español

Ejemplos:

- `crear_emergencia.use-case.ts`
- `buscar_ambulancias_cercanas.use-case.ts`
- `asignar_ambulancia.use-case.ts`
- `registrar_ubicacion.dto.ts`
- `emergencia.entity.ts`
- `emergencia.repository.ts`
- `emergencia.controller.ts`
- `emergencia.service.ts`

Clases:

- `CrearEmergencia`
- `BuscarAmbulanciasCercanas`
- `AsignarAmbulancia`
- `Emergencia`
- `EmergenciaRepository`
- `EmergenciaController`

Variables y métodos:

- `emergenciaId`
- `ambulanciasDisponibles`
- `ubicacionActual`
- `obtenerEmergencia()`
- `crearEmergencia()`
- `asignarAmbulancia()`
- `registrarUbicacion()`

No mezcles idiomas sin necesidad. Los nombres propios de tecnologías, protocolos, librerías y conceptos técnicos establecidos pueden permanecer en inglés.

## 4. Arquitectura hexagonal y casos de uso

El backend debe organizarse alrededor del dominio y de los casos de uso, no alrededor de los controladores ni de las tablas de la base de datos.

Cada módulo de negocio debe separar las responsabilidades de presentación, aplicación, dominio e infraestructura.

Estructura orientativa:

```text
src/
├── app.module.ts
├── main.ts
├── config/
├── common/
│   ├── decorators/
│   ├── guards/
│   ├── filters/
│   ├── interceptors/
│   ├── exceptions/
│   └── utils/
├── database/
│   ├── prisma.service.ts
│   └── prisma.module.ts
└── modules/
    ├── autenticacion/
    ├── usuarios/
    ├── ambulancias/
    ├── emergencias/
    ├── asignaciones/
    ├── ubicaciones/
    ├── atencion_prehospitalaria/
    ├── notificaciones/
    ├── reportes/
    └── auditoria/
```

Los nombres de las carpetas de módulos también deben estar en inglés. Por tanto, en la implementación se utilizarán nombres como `authentication/`, `users/`, `ambulances/`, `emergencies/`, `assignments/`, `locations/`, `prehospital_care/`, `notifications/`, `reports/` y `audit/`.

Cada módulo tendrá únicamente las capas que realmente necesite:

```text
emergencies/
├── domain/
│   ├── entities/
│   ├── repositories/
│   └── services/
├── application/
│   └── use-cases/
├── infrastructure/
│   ├── repositories/
│   └── services/
├── presentation/
│   ├── controllers/
│   ├── dto/
│   └── gateways/
├── test/
│   ├── domain/
│   ├── application/
│   └── dobles/
└── emergencies.module.ts
```

Los archivos internos conservarán los nombres en español y las convenciones del proyecto.

Las pruebas del módulo van en su carpeta `test/` y nunca junto al código de producción (ver la sección 13).

No es obligatorio crear todas las carpetas en todos los módulos. Crea únicamente las que tengan una responsabilidad real.

### Dominio

Contiene las entidades, reglas de negocio e interfaces de los repositorios.

El dominio:

- No debe depender de NestJS, Prisma, HTTP ni de una base de datos específica.
- No debe importar clases de infraestructura.
- Debe expresar las reglas del negocio de forma independiente de los detalles técnicos.
- No debe contener consultas Prisma ni lógica de transporte HTTP.

### Aplicación

Contiene los casos de uso que coordinan las operaciones del sistema.

Ejemplos:

- `CrearEmergencia`
- `ConsultarEmergenciasActivas`
- `DetectarEmergenciasDuplicadas`
- `BuscarAmbulanciasCercanas`
- `AsignarAmbulancia`
- `AceptarAsignacion`
- `RechazarAsignacion`
- `ActualizarEstadoAmbulancia`
- `RegistrarUbicacionAmbulancia`
- `RegistrarAtencionPrehospitalaria`
- `ConsultarHistorialEmergencia`

Cada caso de uso debe tener una responsabilidad concreta, recibir datos de entrada definidos y devolver un resultado explícito.

No crees un caso de uso por cada línea de código ni dividas operaciones sencillas en múltiples clases sin una justificación real.

### Infraestructura

Implementa los detalles técnicos:

- Repositorios concretos con Prisma.
- Adaptadores para servicios externos.
- Integraciones de geolocalización, mapas o notificaciones.
- Implementaciones de almacenamiento y otros mecanismos técnicos.

Los repositorios de infraestructura implementan los contratos definidos por el dominio.

### Presentación

Contiene controladores REST, DTO, gateways de WebSocket y mecanismos de entrada y salida.

Su responsabilidad es validar y transformar las solicitudes, invocar los casos de uso y devolver respuestas adecuadas.

Los controladores no deben contener reglas de negocio, consultas Prisma ni procesos complejos.

## 5. Reglas para los casos de uso

Los casos de uso son la unidad principal de la lógica de aplicación.

Cada caso de uso debe:

1. Recibir dependencias mediante inyección.
2. Validar las condiciones de negocio que le corresponden.
3. Consultar o modificar información mediante interfaces de repositorio.
4. Coordinar transacciones cuando la operación lo requiera.
5. Devolver resultados claros y tipados.
6. Comunicar errores de negocio mediante excepciones o resultados definidos.
7. Evitar depender directamente de controladores o DTO HTTP.

Ejemplo conceptual:

```typescript
export class CrearEmergencia {
  constructor(
    private readonly emergenciasRepositorio: EmergenciasRepositorio,
  ) {}

  async ejecutar(
    datos: CrearEmergenciaEntrada,
  ): Promise<Emergencia> {
    const emergencia = Emergencia.crear(datos);

    return this.emergenciasRepositorio.guardar(emergencia);
  }
}
```

El ejemplo es orientativo: adapta las entidades, los contratos y la inyección al diseño real del proyecto.

No crees un servicio genérico que termine concentrando todos los casos de uso de un módulo. Tampoco introduzcas una interfaz para cada función trivial sin necesidad arquitectónica.

## 5. DTO (Data Transfer Objects)

Los DTO son obligatorios para definir y validar los datos que entran y salen de la API. Deben mantener una separación clara entre la capa de presentación, la aplicación, el dominio y la infraestructura.

### 5.1. Ubicación de los DTO

Los DTO de entrada y salida de HTTP deben ubicarse dentro de la capa `presentation/dto/` del módulo correspondiente.

Ejemplo:

```text
modules/
└── emergencies/
    ├── domain/
    │   ├── entities/
    │   ├── repositories/
    │   └── services/
    ├── application/
    │   └── use-cases/
    ├── infrastructure/
    │   └── repositories/
    └── presentation/
        ├── controllers/
        └── dto/
            ├── crear_emergencia.dto.ts
            ├── actualizar_emergencia.dto.ts
            ├── consultar_emergencias.dto.ts
            ├── emergencia_respuesta.dto.ts
            └── emergencia_detalle_respuesta.dto.ts
```

No crees una carpeta global con todos los DTO del sistema. Cada módulo debe ser responsable de sus propios contratos de entrada y salida.

Los DTO compartidos solo deben ubicarse en un módulo común cuando exista una necesidad real de reutilización.

### 5.2. Convenciones de nombres

Los nombres de archivos deben estar en español, en `snake_case`, y terminar con `.dto.ts`.

Ejemplos:

- `iniciar_sesion.dto.ts`
- `crear_usuario.dto.ts`
- `actualizar_usuario.dto.ts`
- `crear_emergencia.dto.ts`
- `asignar_ambulancia.dto.ts`
- `registrar_ubicacion.dto.ts`
- `registrar_atencion_prehospitalaria.dto.ts`
- `consultar_emergencias.dto.ts`
- `emergencia_respuesta.dto.ts`

Las clases deben usar PascalCase y nombres en español:

- `IniciarSesionDto`
- `CrearUsuarioDto`
- `ActualizarUsuarioDto`
- `CrearEmergenciaDto`
- `AsignarAmbulanciaDto`
- `RegistrarUbicacionDto`
- `EmergenciaRespuestaDto`

### 5.3. DTO de entrada

Cada operación HTTP debe recibir un DTO específico que describa los datos permitidos.

Ejemplos:

- Crear un recurso: `CrearEmergenciaDto`.
- Actualizar un recurso: `ActualizarEmergenciaDto`.
- Filtrar resultados: `ConsultarEmergenciasDto`.
- Registrar una ubicación: `RegistrarUbicacionDto`.

Utiliza `class-validator` y `class-transformer` para validar y transformar los datos cuando corresponda.

Ejemplo:

```typescript
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min, Max } from 'class-validator';

export class CrearEmergenciaDto {
  @IsString()
  @MaxLength(500)
  descripcion: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitud: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitud: number;

  @IsOptional()
  @IsEnum(['baja', 'media', 'alta'])
  prioridad?: 'baja' | 'media' | 'alta';
}
```

Este ejemplo es ilustrativo: los campos, los tipos y las reglas definitivas deben corresponder al modelo real del dominio y a los requisitos aprobados. No asumas que la prioridad clínica puede ser establecida libremente por cualquier usuario.

### 5.4. Validación global

Configura un `ValidationPipe` global en NestJS con opciones adecuadas, incluyendo:

- `whitelist: true`
- `forbidNonWhitelisted: true`
- `transform: true`

Las solicitudes inválidas deben rechazarse antes de ejecutar el caso de uso.

Valida los tipos, formatos, longitudes, rangos, enumeraciones e identificadores. Para fechas, coordenadas, paginación y filtros, establece reglas explícitas.

No confíes en las validaciones del frontend: el backend es la autoridad.

### 5.5. DTO de actualización

Los DTO de actualización deben contemplar que algunos campos sean opcionales, sin permitir que se modifiquen propiedades protegidas.

Puedes utilizar `PartialType` de `@nestjs/mapped-types` cuando corresponda y sea compatible con las validaciones del DTO original.

No permitas que una actualización modifique libremente:

- Identificadores primarios.
- Fechas de creación.
- Roles o permisos sin autorización.
- Propietarios de recursos.
- Estados operativos restringidos.
- Datos de auditoría.
- Campos clínicos protegidos.

Las operaciones que cambien estados críticos deben tener DTO y casos de uso específicos cuando sus reglas de negocio sean diferentes.

### 5.6. DTO de salida

No devuelvas directamente entidades de dominio, registros completos de Prisma ni objetos internos del sistema.

Define DTO o modelos de respuesta explícitos para controlar qué información recibe el cliente.

Ejemplos:

- `UsuarioRespuestaDto`
- `EmergenciaRespuestaDto`
- `AmbulanciaRespuestaDto`
- `AsignacionRespuestaDto`
- `AtencionPrehospitalariaRespuestaDto`

Las respuestas deben excluir contraseñas, hashes, secretos, campos internos y cualquier información clínica o personal que el usuario no esté autorizado a consultar.

No expongas automáticamente todas las propiedades de una entidad o un modelo Prisma.

### 5.7. Separación entre DTO, dominio y casos de uso

Los DTO pertenecen a la capa de presentación y no deben convertirse en las entidades del dominio.

El flujo esperado es:

1. El controlador recibe y valida el DTO.
2. El controlador transforma los datos de entrada al formato requerido por el caso de uso.
3. El caso de uso ejecuta las reglas de negocio sin depender de DTO HTTP.
4. El repositorio persiste los datos mediante Prisma.
5. El resultado se transforma en un DTO de respuesta adecuado.

No importes DTO de `presentation/` dentro de `domain/`.

Si la aplicación necesita contratos internos de entrada o salida, defínelos en la capa `application/`, con nombres como `CrearEmergenciaEntrada` o `CrearEmergenciaResultado`, sin acoplarlos al protocolo HTTP.

No crees conversiones redundantes si los tipos ya son compatibles; realiza únicamente las transformaciones necesarias.

### 5.8. Documentación Swagger

Documenta los DTO utilizados por los endpoints con decoradores de Swagger, como `@ApiProperty` y `@ApiPropertyOptional`, cuando corresponda.

Describe:

- Propósito de cada campo.
- Tipo de dato.
- Si es obligatorio u opcional.
- Formato esperado.
- Restricciones relevantes.
- Valores permitidos cuando aplique.

Mantén sincronizadas las validaciones, los DTO y la documentación. No documentes como opcional un campo obligatorio ni anuncies propiedades que la API no acepta.

### 5.9. Regla obligatoria

**No implementes endpoints que reciban objetos arbitrarios sin DTO y validación explícita.**

No utilices `any`, objetos genéricos sin tipado ni modelos Prisma como contratos HTTP. Cada endpoint debe definir claramente qué recibe, qué valida y qué devuelve.

Mantén los DTO pequeños, específicos y coherentes con la operación. No crees abstracciones innecesarias ni un único DTO reutilizado para operaciones que tengan reglas distintas.

## 6. Prisma y acceso a datos

Prisma será la herramienta de acceso a datos.

Reglas obligatorias:

- Los modelos y relaciones deben representar el dominio de manera coherente.
- Las consultas Prisma deben permanecer en la infraestructura, principalmente en los repositorios concretos.
- No utilices `PrismaClient` directamente en controladores ni en entidades de dominio.
- Evita duplicar consultas y reglas de persistencia.
- Selecciona únicamente los campos necesarios mediante `select` o mecanismos equivalentes.
- Usa transacciones para operaciones que deban mantener consistencia entre varios cambios.
- Define restricciones e índices adecuados para las consultas frecuentes.
- Controla las relaciones, claves foráneas, valores únicos y campos obligatorios.
- Gestiona las migraciones con Prisma Migrate.
- No alteres la base de datos de producción de manera destructiva.
- No uses `prisma db push` como sustituto habitual de migraciones en entornos controlados de producción.
- No borres ni recrees tablas con información real para resolver errores de desarrollo.
- No expongas modelos Prisma completos como respuestas HTTP.

Los datos de entrada y salida de la aplicación deben estar separados de los modelos de persistencia. Convierte los registros de Prisma a las entidades o resultados de aplicación necesarios.

Los nombres de modelos, campos y relaciones de Prisma deben seguir una convención consistente y documentada. Siempre que sea viable, utiliza nombres en español, sin sacrificar compatibilidad ni claridad.

## 7. Autenticación JWT y autorización

Toda autenticación de usuarios debe utilizar JWT de forma segura.

Implementa:

- Inicio de sesión mediante credenciales verificadas en el servidor.
- Contraseñas almacenadas con un algoritmo de hash apropiado, como Argon2id o bcrypt.
- Tokens de acceso con expiración.
- Estrategia JWT para verificar los tokens.
- Guards para proteger las rutas.
- Decoradores para acceder al usuario autenticado y sus permisos.
- Autorización basada en roles y, cuando corresponda, permisos específicos.
- Validación de los datos recibidos y respuestas de autenticación genéricas para evitar revelar si una cuenta existe.
- Configuración de secretos mediante variables de entorno o un gestor de secretos.

No almacenes contraseñas en texto plano. Nunca incluyas contraseñas, secretos o tokens completos en logs.

No confundas autenticación con autorización: validar un JWT no significa que el usuario tenga permiso para realizar cualquier acción.

Los roles iniciales deben contemplar las responsabilidades reales del sistema, por ejemplo:

- Administrador.
- Operador o despachador.
- Personal prehospitalario.

Los permisos deben validarse en el backend, aunque el frontend también oculte opciones no permitidas.

Un usuario no debe poder consultar historias clínicas, modificar asignaciones o cambiar estados de ambulancias fuera de sus permisos solo por conocer un identificador.

El acceso a historias clínicas y datos sensibles debe limitarse según el rol, el contexto asistencial y las políticas autorizadas.

Si se implementan refresh tokens, deben tener expiración, rotación y revocación seguras. No los añadas automáticamente si el alcance actual no los necesita.

## 8. Validación, DTO y respuestas

Toda entrada externa debe validarse en el backend.

- Utiliza DTO específicos para cada operación.
- Configura la validación global de NestJS con opciones seguras, como `whitelist` y `forbidNonWhitelisted`.
- Valida formatos, tipos, rangos, longitudes e identificadores.
- No confíes en los datos enviados por el frontend.
- No utilices DTO de creación como DTO de actualización si sus reglas son diferentes.
- No permitas que el cliente defina campos protegidos, como roles, propietario de registros o estados administrativos restringidos.
- Mantén respuestas coherentes y evita exponer detalles internos.

Utiliza los códigos HTTP adecuados: `400` para solicitudes inválidas, `401` para falta de autenticación válida, `403` para falta de permisos, `404` cuando corresponda y `409` para conflictos de negocio.

No devuelvas trazas de errores, consultas SQL, secretos ni mensajes internos al cliente.

## 9. Reglas de negocio de Ambulancias Galenos

La lógica de emergencias y despachos debe mantenerse en casos de uso y servicios de dominio cuando corresponda.

### Emergencias y reportes

Distingue entre un reporte recibido y una emergencia confirmada. Varios ciudadanos pueden reportar un mismo incidente, sin que eso obligue a crear varias emergencias.

La detección de posibles duplicados debe utilizar criterios configurables, como proximidad geográfica, tiempo, tipo de incidente y descripción.

Un posible duplicado debe revisarse con reglas explícitas; no se deben fusionar incidentes automáticamente solo porque sus coordenadas sean cercanas.

Un reporte sospechoso no debe considerarse falso automáticamente ni reducir la prioridad clínica sin una evaluación autorizada.

### Ambulancias y asignaciones

La selección de ambulancias debe considerar:

- Estado operativo y disponibilidad.
- Ubicación conocida y antigüedad del dato GPS.
- Compatibilidad con el servicio solicitado.
- Asignaciones vigentes y capacidad operativa.
- Tiempo estimado de llegada por carretera, cuando esté disponible.

No utilices exclusivamente la distancia en línea recta para determinar qué ambulancia llegará primero.

Controla las asignaciones concurrentes para impedir que una misma ambulancia quede asignada a dos emergencias incompatibles.

Define transiciones válidas para los estados de una emergencia, una ambulancia y una asignación. Evita cambios arbitrarios de estado desde el cliente.

### Geolocalización y tiempo real

La ubicación de una ambulancia debe registrar, como mínimo, las coordenadas, la fecha de captura y la información de vigencia que requiera el sistema.

No consideres actual una ubicación antigua. Controla permisos, errores de GPS, pérdida de conexión y mensajes recibidos fuera de orden.

Utiliza REST para las operaciones convencionales y WebSocket para transmitir actualizaciones en tiempo real cuando corresponda.

El backend debe verificar la identidad y los permisos de cada conexión y mensaje WebSocket. No confíes en el identificador de ambulancia enviado por el cliente sin comprobar que el usuario esté autorizado para reportar su ubicación.

La frecuencia de actualización debe ser configurable y razonable para el consumo de batería, ancho de banda y capacidad del servidor.

### Atención prehospitalaria

Los registros clínicos deben validarse y asociarse con la emergencia correspondiente y el personal autorizado.

Las modificaciones relevantes deben mantener trazabilidad. No sobrescribas silenciosamente datos clínicos que deban conservar su historial.

Protege la información personal y de salud; registra los accesos y cambios relevantes conforme a las políticas de auditoría y conservación del sistema.

## 10. Errores y excepciones

Maneja los errores de forma consistente.

- Define excepciones de negocio cuando aporten claridad.
- Utiliza filtros de excepciones de NestJS para normalizar las respuestas.
- No captures errores para ignorarlos.
- No conviertas todos los errores en respuestas `200`.
- No expongas detalles técnicos internos en producción.
- Registra información útil para diagnóstico sin incluir datos clínicos, contraseñas, tokens o información personal innecesaria.

Diferencia los errores esperados de negocio de los errores inesperados de infraestructura.

## 11. Seguridad y protección de datos

Aplica las siguientes medidas:

- HTTPS en todos los entornos expuestos.
- CORS restringido a los orígenes autorizados.
- Rate limiting en endpoints sensibles, especialmente autenticación y recepción de reportes.
- Validación de entradas y control de acceso en cada operación.
- Gestión segura de variables de entorno y secretos.
- Auditoría de operaciones sensibles.
- Protección contra asignaciones fraudulentas, modificación no autorizada de estados y suplantación de identidad.
- Minimización de datos en respuestas, logs y eventos de WebSocket.
- Políticas de retención y eliminación de datos definidas por el proyecto.
- Revisión de requisitos colombianos aplicables a datos personales e información de salud.

No incluyas información sensible en mensajes públicos, notificaciones generales o eventos enviados a usuarios que no estén autorizados para verla.

## 12. Calidad del código y TypeScript

- Mantén TypeScript en modo estricto.
- **No utilices `any`.** Prefiere tipos concretos, genéricos bien definidos, `unknown` con validación o tipos discriminados.
- Evita `as` para ocultar incompatibilidades de tipos.
- Evita el uso indiscriminado de `!` para forzar valores no nulos.
- No dupliques lógica de negocio.
- No crees funciones gigantes ni clases que concentren demasiadas responsabilidades.
- Utiliza nombres descriptivos en español.
- Prefiere funciones pequeñas con responsabilidades claras.
- Evita abstracciones prematuras, patrones innecesarios y capas que no aporten valor.
- No utilices `console.log` como mecanismo definitivo de logging en producción.
- Mantén los módulos cohesivos y con dependencias explícitas.

No agregues comentarios que simplemente repitan lo que hace el código. Documenta las reglas complejas y decisiones cuyo motivo no sea evidente.

## 13. Pruebas

Añade pruebas según el riesgo y la responsabilidad de cada componente.

- **Unitarias:** entidades, reglas de dominio y casos de uso.
- **Integración:** repositorios Prisma y operaciones con base de datos.
- **E2E:** autenticación, permisos, creación de emergencias, asignaciones y flujos principales.

Prioriza casos críticos:

- Inicio de sesión válido e inválido.
- Token expirado o inválido.
- Usuario sin permisos.
- Reportes duplicados.
- Ambulancia no disponible.
- Conflictos de asignación concurrente.
- Ubicaciones antiguas o inválidas.
- Cambios de estado no permitidos.
- Acceso no autorizado a registros prehospitalarios.

Las pruebas no deben depender de datos reales sensibles ni de servicios externos sin control.

### Ubicación de las pruebas

**Cada módulo tiene su propia carpeta `test/`. No coloques archivos `.spec.ts` dentro de `domain/`, `application/`, `infrastructure/` ni `presentation/`.**

Dentro de `test/` se replica la ruta del archivo que se prueba, de modo que cada prueba se identifique por su ubicación:

| Código | Prueba |
| --- | --- |
| `modules/ambulances/domain/entities/turno.entity.ts` | `modules/ambulances/test/domain/entities/turno.entity.spec.ts` |
| `modules/ambulances/application/use-cases/crear_ambulancia.use-case.ts` | `modules/ambulances/test/application/use-cases/crear_ambulancia.use-case.spec.ts` |
| `modules/emergencies/domain/services/criterios_duplicados.ts` | `modules/emergencies/test/domain/services/criterios_duplicados.spec.ts` |

Estructura dentro de un módulo:

```text
modules/assignments/
├── domain/
├── application/
├── infrastructure/
├── presentation/
├── test/
│   ├── domain/
│   │   └── entities/
│   │       └── asignacion.entity.spec.ts
│   ├── application/
│   │   └── use-cases/
│   │       └── flujo_asignacion.use-case.spec.ts
│   └── dobles/                      # dobles que solo usa este módulo
│       └── asignaciones_memoria.ts
└── assignments.module.ts
```

Reglas:

- Las pruebas unitarias e integración terminan en `.spec.ts`; las E2E, en `.e2e-spec.ts`.
- Los **dobles de prueba** (repositorios en memoria, servicios falsos) que usa **un solo módulo** van en `<modulo>/test/dobles/`.
- Los dobles que comparten **varios módulos** van en la carpeta `test/dobles/` de la raíz del proyecto. Por ejemplo, `AuditoriaMemoria`, `AmbulanciasMemoria`, `EmergenciasMemoria` y `TurnosMemoria`.
- Las pruebas **E2E** van en la carpeta `test/` de la raíz (`test/*.e2e-spec.ts`), porque recorren varios módulos.
- Las pruebas importan el código con rutas relativas y extensión `.js`, igual que el resto del proyecto.
- Las carpetas `src/**/test/**` están excluidas del build (`tsconfig.build.json`): nada de prueba llega a `dist/`.
- Crea solo las subcarpetas que tengan pruebas; no crees carpetas vacías.

## 14. Documentación y configuración

Mantén Swagger actualizado con descripciones útiles, DTO y respuestas esperadas.

Utiliza variables de entorno para credenciales, secretos, conexiones y configuración específica por ambiente.

Proporciona un `.env.example` sin valores secretos reales.

Si el proyecto incorpora Docker, mantén una configuración reproducible y evita introducir credenciales en imágenes o archivos versionados.

No generes documentación extensa para cada cambio pequeño; documenta lo necesario para ejecutar, mantener y comprender el sistema.

## 15. Forma de trabajo de Claude

Antes de implementar cualquier funcionalidad:

1. Inspecciona la estructura existente del proyecto.
2. Revisa `package.json`, la configuración de TypeScript, NestJS, Prisma y las reglas existentes.
3. Identifica los módulos y patrones que ya se están utilizando.
4. Determina las capas y los casos de uso necesarios.
5. Reutiliza componentes existentes cuando sea apropiado.
6. Implementa el cambio con el menor alcance razonable.
7. Ejecuta las pruebas, el análisis de tipos y el lint disponibles.
8. Informa qué archivos modificaste, qué decisiones tomaste y qué verificaciones ejecutaste.

No afirmes que las pruebas pasaron si no las ejecutaste.

No reescribas módulos completos por una modificación pequeña. No cambies dependencias, arquitectura, nombres públicos de endpoints ni esquemas de base de datos sin justificar el cambio.

Si falta una decisión importante, analiza primero el contexto existente. Pregunta antes de tomar decisiones que puedan comprometer datos, seguridad, compatibilidad o arquitectura.

**Regla principal:** prioriza una arquitectura hexagonal clara, casos de uso con responsabilidades concretas, seguridad, consistencia de los datos y código fácil de mantener. No compliques el sistema innecesariamente.