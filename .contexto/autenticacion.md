# Módulo de autenticación (`src/modules/authentication`)

> Contexto general en [00-general.md](00-general.md). Guía para frontend: `docs/api-usuarios-roles-frontend.md` (sección 2).

## Qué hace

Inicio y cierre de sesión, perfil del usuario actual y cambio de contraseña propia. Usa JWT **respaldado por sesiones en base de datos** para poder revocar tokens antes de que expiren.

## Endpoints

| Método | Ruta | Acceso | Caso de uso | Respuesta |
| --- | --- | --- | --- | --- |
| POST | `/autenticacion/iniciar-sesion-ciudadano` | pública, 5 intentos/min por IP | `IniciarSesion.ejecutarConDocumento` | Igual que el login con correo. **Solo ciudadanos**: el documento de otro rol recibe `401` y la auditoría registra el motivo `acceso_no_corresponde_al_rol`. El documento se normaliza con `common/utils/documento_identidad.ts` (2026-11-02) |
| POST | `/autenticacion/iniciar-sesion` | pública (`@Publico()`), 5 intentos/min por IP | `IniciarSesion.ejecutar` | `200` `{ tokenAcceso, tipoToken: "Bearer", expiraEn, usuario }`. **Solo personal** (desde 2026-11-12): un ciudadano recibe el mismo `401` genérico, aunque la contraseña sea correcta, y la auditoría registra `acceso_no_corresponde_al_rol` |
| GET | `/autenticacion/perfil` | cualquier rol | `ObtenerPerfil` | `200` usuario actual |
| POST | `/autenticacion/cerrar-sesion` | cualquier rol | `CerrarSesion` | `204`, revoca la sesión actual |
| PATCH | `/autenticacion/contrasena` | cualquier rol, 5 intentos/min | `CambiarContrasena` | `204`, revoca **todas** las sesiones |

Todas las demás rutas de la API exigen `Authorization: Bearer <tokenAcceso>` (guard global).

## Cómo funciona

### Token

- HS256, firmado con `JWT_SECRETO`, con `issuer` fijo (`EMISOR_JWT`).
- Carga: `sub` = id del usuario, `sid` = id de la sesión.
- Duración: `JWT_EXPIRACION_SEGUNDOS` (8 h por defecto).
- En la tabla `sesiones` se guarda el **hash del token** (`tokenHash`), nunca el token.

### Inicio de sesión (`IniciarSesion`)

1. Busca el usuario por correo normalizado.
2. Verifica la contraseña con Argon2. **Si el correo no existe, verifica contra un hash ficticio** para que el tiempo de respuesta no revele qué cuentas existen.
3. Si el usuario no existe, la contraseña es incorrecta o el usuario no está `activo` → `401` "Credenciales inválidas" (mismo mensaje en todos los casos) y se audita `inicio_sesion_fallido` con el motivo (`usuario_inexistente`, `contrasena_invalida`, `usuario_bloqueado`, `usuario_inactivo`).
4. Si todo está bien: emite el token, guarda la `Sesion`, actualiza `ultimoAcceso` y audita `iniciar_sesion`.

### Validación en cada solicitud (`ValidarSesion`)

`JwtStrategy` valida firma, emisor y expiración, y luego llama a `ValidarSesion`, que exige:
- que la sesión exista, sea del mismo usuario y esté vigente (no revocada y no expirada);
- que el usuario exista y siga `activo`.

Si algo falla → `401` "Sesión inválida o expirada". Por eso **bloquear o inactivar a un usuario, cerrar sesión o cambiar la contraseña invalidan el token de inmediato**.

El resultado queda en `request.user` como `UsuarioAutenticado` `{ id, correo, rol, sesionId }`, que usan `RolesGuard`, `@UsuarioActual()` y `@Contexto()`.

### Cambio de contraseña (`CambiarContrasena`)

- La contraseña actual debe ser correcta → si no, `422`.
- La nueva debe ser distinta de la actual → si no, `422`.
- Guarda el nuevo hash, **revoca todas las sesiones del usuario** y audita `cambiar_contrasena`.

## Entidad `Sesion`

Campos: `id`, `usuarioId`, `tokenHash`, `expiraEn`, `revocadaEn | null`, `creadaEn`. Método `estaVigente(ahora)`.

Repositorio `SesionesRepositorio`: `guardar`, `buscarPorId`, `revocar`, `revocarTodasDelUsuario`.

## Archivos clave

- `domain/services/emisor_tokens.service.ts` (contrato) → `infrastructure/services/jwt_emisor_tokens.service.ts`.
- `infrastructure/strategies/jwt.strategy.ts`.
- `infrastructure/repositories/prisma_sesiones.repository.ts`.
- El módulo importa `UsersModule` (usa `UsuariosRepositorio` y `HashContrasena`) y `AuditModule`.
- La tabla `sesiones` viene de la migración `20261023235257_sesiones`.

## Pruebas

`iniciar_sesion.use-case.spec.ts` y `validar_sesion.use-case.spec.ts`, con `SesionesMemoria`, `EmisorTokensFalso` y `HashFalso` de `test/dobles/repositorios_memoria.ts`.

## Un acceso por público (2026-11-12)

La regla vive en el caso de uso `IniciarSesion`: cada acceso recibe un predicado `admitido` (`esPersonal` para el correo, `esCiudadano` para la cédula).

- **Con la contraseña correcta pero el acceso equivocado** se responde lo mismo que con una contraseña incorrecta (`401 Credenciales inválidas`). Así la respuesta no revela qué cuentas existen ni de qué rol son.
- **El tiempo de respuesta tampoco lo revela:** siempre se verifica el hash.
- **En la auditoría**, `inicio_sesion_fallido` lleva uno de estos motivos:
  - `usuario_inexistente`
  - `contrasena_invalida`
  - `acceso_no_corresponde_al_rol`
  - `usuario_<estado>`
- **Motivo del cambio:** un ciudadano podía entrar al login del personal de la app con su correo y terminaba en la vista ciudadana.

