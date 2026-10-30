# Ambulancias Galenos — API

NestJS 12 + Prisma 7 (MySQL 8.4) con arquitectura hexagonal. Reglas del proyecto en [`docs/arquitectura.md`](docs/arquitectura.md) y modelo de datos vigente en [`docs/ambulancias_galenos (1).dbml`](<docs/ambulancias_galenos (1).dbml>) (implementado en [`prisma/schema.prisma`](prisma/schema.prisma)).

## Puesta en marcha

```bash
cp .env.example .env          # completar JWT_SECRETO, contraseñas y SEMILLA_ADMIN_CONTRASENA
docker compose up -d          # MySQL en el puerto DB_PUERTO (3311 por defecto)
npm install                   # ejecuta también `prisma generate`
npm run db:migrar             # aplica migraciones (desarrollo)
npm run db:semilla            # roles y administrador inicial
npm run start:dev
```

- API: `http://localhost:3000/api/v1`
- Swagger (fuera de producción): `http://localhost:3000/api/docs`

En producción use `npm run db:desplegar` (`prisma migrate deploy`), nunca `db push`.

Para el día a día basta con `docker compose up -d` y `npm run start:dev`: Prisma no es un servicio aparte, solo necesita que MySQL esté encendido.

## Base de datos (Prisma)

| Comando | Uso |
| --- | --- |
| `npx prisma studio` | Interfaz web para ver y editar los datos |
| `npm run db:migrar -- --name <nombre>` | Tras cambiar `schema.prisma`: crea y aplica una migración nueva |
| `npx prisma generate` | Regenera el cliente en `src/generated/prisma` |
| `npm run db:semilla` | Sincroniza roles y crea el administrador si no existe (idempotente) |

Convención del esquema: modelos en PascalCase singular y campos en camelCase; tablas y columnas físicas en snake_case mediante `@@map` / `@map`. No edite una migración ya aplicada: cree una nueva.

## Scripts

| Script | Uso |
| --- | --- |
| `npm test` | Pruebas unitarias (Vitest) |
| `npm run typecheck` | Verificación de tipos |
| `npm run lint` | Oxlint |
| `npm run build` | Compilación a `dist/` |

## Estructura

```text
src/
├── common/        # errores de dominio, filtro global, guards, decoradores, roles, bus de eventos
├── config/        # validación de variables de entorno
├── database/      # PrismaService
└── modules/
    ├── ambulances/      # flota, tipos de ambulancia, estados operativos y turnos
    ├── assignments/     # despacho de ambulancias y avance del servicio
    ├── audit/           # registro de eventos de auditoría
    ├── authentication/  # inicio/cierre de sesión, perfil, cambio de contraseña
    ├── emergencies/     # registro de emergencias, cancelación y duplicados
    ├── geocoding/       # dirección → coordenadas (Geoapify, con caché en BD)
    ├── locations/       # ubicación GPS y recorridos
    ├── notifications/   # qué se notifica en tiempo real y a quién (lo entrega a ../../webSocket)
    ├── routing/         # rutas por calles hacia la emergencia (Geoapify), recálculo por desvío
    ├── prehospital_care/ # historia clínica prehospitalaria e instituciones de salud
    └── users/           # usuarios y roles
```

## Geocodificación (Geoapify)

`POST /geocodificacion` convierte una dirección en coordenadas y `POST /geocodificacion/inversa`, un punto del mapa en dirección. Ambos buscan primero en su tabla (`direcciones_geocodificadas` y `geocodificaciones_inversas`) y solo consultan al proveedor si no tienen el dato.

| Variable | Obligatoria | Por defecto | Uso |
| --- | --- | --- | --- |
| `GEOAPIFY_API_KEY` | No | — | Clave de [Geoapify](https://myprojects.geoapify.com). Sin ella (o enmascarada), el endpoint responde `503`; la API arranca igual |
| `GEOCODIFICACION_PROVEEDORES` | No | `geoapify` | Proveedores en orden, separados por coma; el siguiente es el respaldo |
| `GEOCODIFICACION_PAIS` | No | `co` | Código ISO del país al que se restringe la búsqueda |
| `GEOCODIFICACION_CIUDAD_PREDETERMINADA` | No | — | Ciudad que se asume si la solicitud no la trae. Vacía = la ciudad es obligatoria |
| `GEOCODIFICACION_CONFIANZA_MINIMA` | No | `0.6` | Confianza mínima (0–1) para aceptar un resultado |
| `GEOCODIFICACION_TIEMPO_ESPERA_MS` | No | `8000` | Tiempo máximo de espera por proveedor |
| `GEOCODIFICACION_INVERSA_DISTANCIA_MAXIMA_M` | No | `100` | En la inversa, hasta cuántos metros la calle encontrada describe el punto; más lejos solo se informa la zona |

Las tablas se crean con las migraciones `20261024152813_direcciones_geocodificadas` y `20261024174516_geocodificaciones_inversas`: `npm run db:migrar` en desarrollo, `npm run db:desplegar` en producción. Detalle en [`.contexto/geocodificacion.md`](.contexto/geocodificacion.md).

## Rutas de las ambulancias

El backend calcula la ruta por calles de cada ambulancia hacia su emergencia (al despachar y cuando se desvía) con la misma `GEOAPIFY_API_KEY`, la guarda en `rutas_asignacion` y la avisa por tiempo real (`asignacion.ruta_actualizada`). Endpoints: `GET /rutas/activas` y `GET /asignaciones/{id}/ruta`. Migración `20261024234520_rutas_asignacion`.

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `RUTAS_PROVEEDORES` | `geoapify` | Proveedores en orden (el siguiente es el respaldo) |
| `RUTAS_DISTANCIA_DESVIO_M` | `150` | A cuántos metros de la ruta se recalcula |
| `RUTAS_INTERVALO_RECALCULO_S` | `60` | Mínimo entre dos recálculos del mismo servicio |
| `RUTAS_TIEMPO_ESPERA_MS` | `8000` | Tiempo máximo de espera del proveedor |

## Ciclo de atención

`PATCH /asignaciones/{id}/avance` recorre `asignada → en_camino → en_escena → atendiendo → trasladando → finalizada` (con cierre sin traslado desde `en_escena` o `atendiendo`, con motivo). La llegada la confirma solo el conductor con GPS; el radio de referencia es `ASIGNACIONES_RADIO_LLEGADA_M` (100 m por defecto) y fuera de él exige `confirmarFueraDeRadio` + `observacion`. Cada paso se guarda en `eventos_asignacion` con fecha, responsable, rol y posición (restricción única por servicio y estado), y se consulta en `GET /asignaciones/{id}/eventos`. Migración `20261025143827_ciclo_atencion`.

## Historia clínica

`/historias-clinicas` (módulo `prehospital_care`): una HC por paciente, la llenan solo el paramédico o el médico del turno; el administrador consulta y anula. Borrador editable → cierre con validaciones y huella SHA-256 (`hash_cierre`) → no se edita más. Ids generados en el celular (reenviar no duplica). Consultas y cambios auditados sin datos clínicos. Usa las tablas existentes (`historias_clinicas`, `signos_vitales`, `lesiones`, `intervenciones`); no requirió migración. La parte de voz (`grabaciones`, `segmentos_audio`) queda pendiente.

## Autenticación y autorización

- `POST /autenticacion/iniciar-sesion` devuelve un JWT (HS256) con `sub` (usuario) y `sid` (sesión). Límite: 5 intentos por minuto por IP.
- Cada solicitud valida que la sesión no esté revocada ni expirada y que el usuario siga activo; bloquear un usuario o cerrar sesión invalida el token de inmediato.
- Todas las rutas requieren autenticación salvo las marcadas con `@Publico()`. Cada usuario tiene un solo rol (`administrador`, `despachador`, `paramedico`, `conductor`); se exige con `@RequiereRoles(...)` y se definen en `src/common/constants/roles.ts`; el seed los sincroniza.
- Contraseñas con Argon2id. Cambiar la contraseña revoca todas las sesiones del usuario.

## Tiempo real

El WebSocket es un servidor aparte: [`../../webSocket`](../../webSocket/README.md). Esta API le entrega cada evento confirmado por HTTP interno, con reintentos, y le verifica las sesiones de quien se conecta. Configure `TIEMPO_REAL_URL` y `TIEMPO_REAL_CLAVE_INTERNA` (la misma clave que `CLAVE_INTERNA` allá); si faltan, la API funciona igual sin notificaciones. Detalle en [`.contexto/tiempo-real.md`](.contexto/tiempo-real.md) y contrato para los clientes en [`docs/api-tiempo-real-frontend.md`](docs/api-tiempo-real-frontend.md).
