# Contexto general — API Ambulancias Galenos

> Última actualización: 2026-10-24. Índice de esta carpeta:
> - [00-general.md](00-general.md): este archivo (stack, arquitectura, convenciones, estado)
> - [ESTADO_PROYECTO.md](ESTADO_PROYECTO.md): resumen de lo hecho, decisiones, errores resueltos y la siguiente tarea
> - [usuarios.md](usuarios.md): usuarios y roles
> - [inventario.md](inventario.md): inventario de bodegas y ambulancias (web administra, paramédico opera su ambulancia)
> - [lista-chequeo.md](lista-chequeo.md): lista de chequeo diaria de la ambulancia (administrador configura, conductor diligencia)
> - [ciudadanos.md](ciudadanos.md): registro de ciudadanos, verificación documental y reportes de emergencia desde la app
> - [autenticacion.md](autenticacion.md): login, sesiones, JWT, contraseña
> - [ambulancias.md](ambulancias.md): flota, tipos y estados operativos
> - [emergencias.md](emergencias.md): registro de emergencias, cancelación y duplicados
> - [turnos.md](turnos.md): tripulaciones por ambulancia
> - [seleccion-ambulancia.md](seleccion-ambulancia.md): el conductor y el paramédico eligen su ambulancia desde la app
> - [ruta-institucion.md](ruta-institucion.md): el conductor elige el hospital y se calcula la ruta del traslado
> - [asignaciones.md](asignaciones.md): despacho y avance del servicio
> - [ubicaciones.md](ubicaciones.md): GPS y recorridos
> - [instituciones-salud.md](instituciones-salud.md): catálogo de destinos
> - [geocodificacion.md](geocodificacion.md): dirección ↔ coordenadas (directa e inversa) con Geoapify y caché en BD
> - [tiempo-real.md](tiempo-real.md): eventos de dominio y puente HTTP con el servidor WebSocket (`../../webSocket`)
> - [rutas.md](rutas.md): rutas por calles de las ambulancias (Geoapify, recálculo por desvío)
> - [historia-clinica.md](historia-clinica.md): historia clínica prehospitalaria (paramédico, cierre con huella, sin señal)
> - [hoja-de-ruta.md](hoja-de-ruta.md): qué falta para la web y la app Flutter, y en qué orden
> - [auditoria.md](auditoria.md): registro de eventos sensibles

## Qué es

Backend del sistema de **despacho de ambulancias y atención prehospitalaria** de Ambulancias Galenos (DKD Ingenierías Software). Ruta: `ambulancia/back/api`.

## Stack

| Pieza | Versión / detalle |
| --- | --- |
| NestJS | 12 (ESM, `"type": "module"`, imports con extensión `.js`) |
| Prisma | 7 con adaptador `@prisma/adapter-mariadb`; cliente generado en `src/generated/prisma` |
| Base de datos | MySQL 8.4. **Desde 2026-10-24 se usa el MySQL local**: base `ambulancia` en `localhost:3306` (sombra: `ambulancia_sombra`). El MySQL de Docker (`docker-compose.yml`, puerto `3311`) sigue disponible: sus URLs quedaron comentadas en `.env` |
| Auth | `@nestjs/jwt` + `passport-jwt` (HS256), Argon2id para contraseñas |
| Validación | `class-validator` + `class-transformer` |
| Docs | Swagger en `/api/docs` (solo fuera de producción), JSON en `/api/docs-json` |
| Pruebas | Vitest (`npm test`), dobles en memoria en `test/dobles/` |
| Lint / formato | oxlint (`--type-aware`) y Prettier |

## Comandos

```bash
docker compose up -d        # levantar MySQL
npm run db:migrar           # prisma migrate dev
npm run db:semilla:inventario-demo   # solo desarrollo: bodega, lotes y equipos DEMO y abastecimiento de ambulancias
npm run db:semilla          # roles, tipos de ambulancia y administrador inicial
npm run start:dev           # API en http://localhost:3000/api/v1
npm run typecheck && npm run lint && npm test
npm run format
```

## Migraciones: una sola desde el 2026-11-09

Las 8 migraciones anteriores (`20261023235103_inicial` … `20261103025936_modulo_ciudadano`) se unieron en **`prisma/migrations/20261109000000_inicial`**, generada desde `schema.prisma`.

- **Comprobado antes de reemplazar:** la BD real no tenía diferencias con el schema (`migrate diff`). La migración nueva, aplicada en una BD vacía, quedó idéntica a la real: 26 tablas, 301 columnas, 87 índices, 44 claves foráneas, mismos motores y collations. Una instalación nueva (`migrate deploy` + `db seed`) crea los 5 roles, los tipos TAB y TAM y el administrador.
- **Los datos base ya no van en migraciones:** el rol `ciudadano` lo crea el seed (`prisma/seed.ts`), junto con los demás roles, los tipos de ambulancia y el administrador. Ejecute siempre `npm run db:semilla` después de migrar una BD nueva.
- **Respaldo de la estructura previa:** `prisma/respaldos/estructura_ambulancia_2026-11-09.sql` (solo estructura, sin datos).
- **Una BD que ya tenía las 8 migraciones** (otro equipo, el contenedor Docker o un servidor) no se recrea: solo se reemplaza el historial. Primero confirme que su estructura está al día (`npx prisma migrate status` con las migraciones viejas, o `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` vacío), y luego:

  ```bash
  mysqldump ... > respaldo.sql                      # respaldo primero
  mysql ... -e "DELETE FROM _prisma_migrations;"    # en esa BD
  npx prisma migrate resolve --applied 20261109000000_inicial
  npx prisma migrate status                          # debe decir: up to date
  ```

  La BD local de desarrollo (MySQL en `localhost:3306`, la del `.env`) ya está así.

Migraciones posteriores a la inicial (todas aditivas): `20261110014254_lista_chequeo` (5 tablas) `20261111223838_inventario` (15 tablas `inv_` con restricciones `CHECK` escritas a mano) y `20261113130557_revision_verificaciones` (revisión de novedades); ver [inventario.md](inventario.md).

## Configuración (`main.ts` y `.env`)

- Prefijo global: `api/v1`.
- `ValidationPipe` global con `whitelist`, `forbidNonWhitelisted` (campos extra → `400`) y `transform`.
- CORS desde `CORS_ORIGENES` (separados por coma). `trust proxy` activo para obtener la IP real.
- Variables validadas al arrancar (`src/config/variables_entorno.ts`): `NODE_ENV`, `PUERTO`, `CORS_ORIGENES`, `DATABASE_URL`, `JWT_SECRETO` (mín. 32 caracteres), `JWT_EXPIRACION_SEGUNDOS` (60–86400; por defecto 28800 = 8 h).
- El seed usa además `SEMILLA_ADMIN_CORREO` y `SEMILLA_ADMIN_CONTRASENA`. Plantilla en `.env.example`. **No copiar valores del `.env` real a documentos.**

### Error "pool failed to retrieve a connection (active=0 idle=0)" (resuelto el 2026-10-26)

Causa: MySQL 8.4 autentica con `caching_sha2_password`. Tras **reiniciar MySQL**, su memoria de autenticación queda vacía y la primera conexión necesita la clave pública RSA del servidor. El driver `mariadb` (que usa Prisma) la rechaza por defecto (`ER_CANNOT_RETRIEVE_RSA_KEY`, 45044), y Prisma lo muestra como "pool failed…". Parecía "arreglarse solo" porque, al entrar con la terminal `mysql` (que usa TLS), la memoria se vuelve a llenar.

Solución: `?allowPublicKeyRetrieval=true` en `DATABASE_URL` (`.env` y `.env.example`). Prisma CLI lo acepta. En producción, preferir TLS. Reproducido y verificado con `FLUSH PRIVILEGES` + login → 200.

## Arquitectura

Monolito modular con capas por módulo (detalle completo en `docs/arquitectura.md`):

```text
src/modules/<modulo>/
├── domain/          # TypeScript puro: entidades con reglas + contratos de repositorio (clases abstractas)
├── application/     # casos de uso: una responsabilidad cada uno, reciben un contrato propio (no el DTO)
├── infrastructure/  # única capa que conoce Prisma; implementa los repositorios
├── presentation/    # controladores delgados + DTOs (validación y Swagger)
└── <modulo>.module.ts   # enlaza contrato → implementación ({ provide: Repo, useClass: PrismaRepo })
```

Módulos actuales: `audit`, `users`, `authentication`, `citizens` (ciudadanos), `checklists` (lista de chequeo), `inventory` (inventario de bodegas y ambulancias, ver [inventario.md](inventario.md)), `ambulances` (incluye turnos), `emergencies`, `assignments`, `locations`, `prehospital_care` (historia clínica e instituciones de salud), `geocoding`, `routing`, `notifications`, `notifications` (tiempo real; ver [tiempo-real.md](tiempo-real.md)) (todos registrados en `src/app.module.ts`). Además, `src/common/events/` tiene el bus de eventos de dominio (`EventosModule`, global).

### Patrones que se repiten

- **Entidades** con constructor privado, `crear()` (nuevo, aplica reglas y normaliza) y `reconstruir()` (desde la BD). Propiedades solo con getters; cambian solo con métodos que validan.
- **Repositorios** son clases abstractas porque NestJS usa la clase como token de inyección.
- **Prisma**: `select` explícito con `satisfies Prisma.XSelect`; `GetPayload` para tipar el registro; método privado `aEntidad()`; `P2002` se traduce a `ConflictoNegocioError`.
- **DTOs de respuesta** con `static desde(entidad)`: nunca se devuelve la entidad ni el registro de Prisma.
- **Listados paginados**: `PaginacionDto` (`pagina` ≥ 1 por defecto 1, `limite` 1–100 por defecto 20) → `ResultadoPaginado<T>` `{ datos, total, pagina, limite }`. Conteo y consulta dentro de `prisma.$transaction([...])`.
- **Auditoría** al final de cada caso de uso que crea o modifica (ver [auditoria.md](auditoria.md)).
- **Contexto** de la solicitud con el decorador `@Contexto()` → `{ usuarioId, direccionIp }`.
- **Pruebas** en la carpeta `test/` de cada módulo, replicando la ruta del archivo que prueban (`ambulances/test/domain/entities/turno.entity.spec.ts`). Dobles compartidos en `test/dobles/` de la raíz; dobles de un solo módulo en `<modulo>/test/dobles/`. Regla completa en `docs/arquitectura.md` §13. (Hasta el 2026-10-24 los `.spec.ts` estaban junto al código; se movieron todos.)

## Capa común (`src/common`)

| Archivo | Qué hace |
| --- | --- |
| `constants/roles.ts` | `Roles` = `administrador`, `despachador`, `paramedico`, `conductor`; `esRolValido()` |
| `exceptions/errores_dominio.ts` | Errores de dominio sin dependencia de HTTP |
| `filters/filtro_excepciones.filter.ts` | Traduce errores a HTTP con formato uniforme |
| `guards/jwt_autenticacion.guard.ts` | Global; deja pasar las rutas `@Publico()` |
| `guards/roles.guard.ts` | Global; valida `@RequiereRoles(...)` |
| `decorators/` | `@Publico()`, `@RequiereRoles()`, `@Contexto()`, `@UsuarioActual()` |
| `dto/paginacion.dto.ts`, `types/` | Paginación, `ContextoSolicitud`, `UsuarioAutenticado` |
| `utils/geografia.ts` | `distanciaMetros()` (haversine), usado por emergencias e instituciones |

Guards globales en orden: `ThrottlerGuard` (120 solicitudes/min) → `JwtAutenticacionGuard` → `RolesGuard`.

### Errores → HTTP

| Error de dominio | HTTP |
| --- | --- |
| `RecursoNoEncontradoError` | 404 |
| `ConflictoNegocioError` | 409 |
| `ReglaNegocioError` | 422 |
| `NoAutenticadoError` | 401 |
| `AccesoDenegadoError` | 403 |
| `ServicioNoDisponibleError` | 503 (servicio externo caído o sin configurar) |
| Validación de DTO | 400 (`mensaje` es arreglo) |
| Cualquier otro | 500 "Error interno del servidor" (se registra en log) |

Cuerpo de error: `{ codigoEstado, error, mensaje, ruta, fecha }`.

**Regla:** los casos de uso lanzan errores de dominio, nunca `new Error(...)` (eso termina en 500).

## Base de datos

- Schema en `prisma/schema.prisma`: modelos en PascalCase singular, tablas en snake_case plural (`@@map`).
- Migraciones: `20261023235103_inicial` (todas las tablas del sistema), `20261023235257_sesiones`, `20261024152813_direcciones_geocodificadas`, `20261024174516_geocodificaciones_inversas`, `20261024234520_rutas_asignacion` y `20261025143827_ciclo_atencion`.
- Tablas ya creadas pero **sin módulo todavía**: `historias_clinicas`, `signos_vitales`, `lesiones`, `intervenciones`, `grabaciones`, `segmentos_audio`.
- Diccionario de tablas: `docs/Base de datos Ambulancias Galenos — diccionario de tablas.md`.

## Documentación existente (`docs/`)

| Archivo | Para quién |
| --- | --- |
| `arquitectura.md` | Reglas de arquitectura del backend |
| `api-usuarios-roles-frontend.md` | Frontend: autenticación, roles y usuarios |
| `api-ambulancias-frontend.md` | Frontend: tipos de ambulancia y ambulancias |
| `api-emergencias-frontend.md` | Frontend: emergencias y duplicados |
| `api-despacho-frontend.md` | Frontend: asignaciones, ubicaciones e instituciones de salud (la sección de turnos fue reemplazada) |
| `instrucciones-agente-flutter.md` | Flutter: selección de ambulancia |
| `RUTA_INSTITUCION_FLUTTER.md` | Flutter: hospital de destino y ruta del traslado |
| `INTEGRACION_MODULO_CIUDADANO_FLUTTER.md` | Flutter: módulo ciudadano (registro, verificación, mapa, reportes) |
| `SEGUIMIENTO_AMBULANCIA_CIUDADANO_FLUTTER.md` | Flutter: el ciudadano ve en el mapa la ambulancia de su reporte |
| `WEBSOCKET_SEGUIMIENTO_CIUDADANO.md` | Servidor WebSocket: aceptar el rol ciudadano y el evento `seguimiento.actualizado` |
| `ACCESO_CEDULA_CIUDADANO_FLUTTER.md` | Flutter: acceso del ciudadano con cédula (¿existe? → contraseña o registro) |
| `INVENTARIO_FLUTTER.md` | Flutter: inventario de la ambulancia del paramédico (consumos, devoluciones, verificaciones) |
| `INVENTARIO_FRONTEND.md` | Frontend web: administración del inventario (catálogo, bodegas, movimientos, dotación, alertas) |
| `implementacion inventario.md` / `bd-inventario.md` | Requisitos y diseño de BD del inventario (entregados por el equipo) |
| `LISTA_CHEQUEO_FLUTTER.md` | Flutter: lista de chequeo diaria del conductor |
| `LISTA_CHEQUEO_FRONTEND.md` | Frontend web: configuración e historial de la lista de chequeo |
| `VERIFICACION_CIUDADANOS_FRONTEND.md` | Frontend web: módulo del administrador para aprobar o rechazar ciudadanos |
| `instrucciones-agente-frontend.md` | Frontend: quitar la asignación de tripulación |
| `api-app-movil.md` | App Flutter: login, sesión y pantalla de inicio (`/mi-servicio`) |
| `api-mapa-ambulancias-frontend.md` | Frontend: mapa de la flota (posiciones, filtros por estado, tiempo real) |
| `api-rutas-frontend.md` | Frontend web y app: rutas de las ambulancias (GeoJSON, ETA, tiempo real) |
| `api-ciclo-atencion-app.md` | App Flutter: ciclo de atención (llegada con GPS por el conductor, atención, traslado, cierre) |
| `api-ciclo-atencion-web.md` | Frontend web: etapas en el mapa, "paciente a bordo", línea de tiempo |
| `api-app-paramedico.md` | App Flutter: inicio del paramédico (tarjeta de emergencia → HC vacía), endpoints y estructura futura de la HC |
| `api-historia-clinica-app.md` | App Flutter: historia clínica (abrir, llenar, signos, lesiones, intervenciones, cerrar, sin señal) |
| `api-tiempo-real-frontend.md` | Frontend y app: WebSocket (conexión, salas, eventos y ejemplos) |
| `guia-modulo-ambulancias.md` | Guía paso a paso para construir el módulo de ambulancias |

## Estado actual (2026-10-24)

- ✅ Auditoría, usuarios/roles, autenticación, ambulancias, emergencias, turnos, asignaciones, ubicaciones e instituciones de salud: **el backend que necesita la web está completo**.
- ✅ `typecheck`, `lint` y `npm test` en verde: **114 pruebas**.
- ✅ Tiempo real: servidor aparte en `../../webSocket`, conectado por HTTP interno (ver [tiempo-real.md](tiempo-real.md)). Probado de punta a punta contra el MySQL local: login, conexión, entrega a la sala del tripulante y desconexión al cerrar sesión.
- ✅ Emergencias y el flujo completo de despacho probados de punta a punta con curl contra el MySQL local.
- ✅ La app Flutter ya puede empezar: login, `GET /mi-servicio`, marcar el avance y reportar el GPS.

## Próximos módulos sugeridos

Ver [hoja-de-ruta.md](hoja-de-ruta.md):
1. ~~**Historia clínica**~~: hecha (manual). Falta la parte de **voz** (grabaciones y transcripción) y la **firma del rechazo**.
