# Módulo de usuarios y roles (`src/modules/users`)

> Contexto general en [00-general.md](00-general.md). Guía para frontend: `docs/api-usuarios-roles-frontend.md`.

## Qué hace

Gestión de las personas que usan el sistema y de su rol. **Todos los endpoints son solo para `administrador`** (`@RequiereRoles(Roles.ADMINISTRADOR)` a nivel de controlador).

## Roles

Fijos, definidos en `src/common/constants/roles.ts` y sincronizados por el seed en la tabla `roles`:

| Rol | Descripción |
| --- | --- |
| `administrador` | Administración general del sistema |
| `despachador` | Recibe las alertas de emergencia y despacha las ambulancias |
| `paramedico` | Atiende al paciente y diligencia la historia clínica |
| `conductor` | Conduce la ambulancia asignada |

**Cada usuario tiene un solo rol.** El frontend envía el `nombre` del rol, no su `id`.

## Endpoints

| Método | Ruta | Caso de uso | Para qué |
| --- | --- | --- | --- |
| GET | `/roles` | `ConsultarRoles` | Opciones del select de rol |
| POST | `/usuarios` | `CrearUsuario` | Crear usuario (nace `activo`) |
| GET | `/usuarios` | `ConsultarUsuarios` | Listar con filtros (`busqueda`, `estado`, `rol`) y paginación |
| GET | `/usuarios/{id}` | `ObtenerUsuario` | Detalle |
| PATCH | `/usuarios/{id}` | `ActualizarUsuario` | Editar nombres, apellidos y teléfono |
| PUT | `/usuarios/{id}/rol` | `AsignarRolUsuario` | Cambiar el rol |
| PATCH | `/usuarios/{id}/estado` | `CambiarEstadoUsuario` | Activar, inactivar o bloquear (con `motivo`) |

## Entidad `Usuario`

Campos: `id`, `nombres`, `apellidos`, `correo`, `telefono | null`, `contrasenaHash`, `estado`, `rol`, `ultimoAcceso | null`, `creadoEn`.

- Estados: `activo` | `inactivo` | `bloqueado`.
- `crear()`: recorta textos, **normaliza el correo** (trim + minúsculas), teléfono vacío → `null`, valida el rol y deja el estado en `activo`.
- Métodos: `estaActivo()`, `tieneRol()`, `actualizarDatosPersonales()`, `cambiarEstado()`, `asignarRol()`, `cambiarContrasena()`.

## Reglas de negocio

1. El **correo es único** (se compara normalizado) → `409` si ya existe.
2. Rol inexistente → `422`.
3. Cambiar al mismo estado → `422` "El usuario ya se encuentra …".
4. Un administrador **no puede cambiar su propio estado** → `422`.
5. Un administrador **no puede quitarse a sí mismo el rol de administrador** → `422`.
6. Inactivar o bloquear **desconecta al usuario de inmediato**: la validación de sesión revisa el estado en cada solicitud (ver [autenticacion.md](autenticacion.md)).
7. El correo, el rol, el estado y la contraseña **no** se editan en `PATCH /usuarios/{id}`; cada uno tiene su propio endpoint.
8. Crear, actualizar, asignar rol y cambiar estado quedan en **auditoría** (el cambio de estado guarda el `motivo`).

## Validaciones de entrada (DTOs)

| Campo | Regla |
| --- | --- |
| `nombres`, `apellidos` | Obligatorios, máx. 100 caracteres |
| `correo` | Correo válido, máx. 150 caracteres |
| `telefono` | Opcional, 7–20 caracteres: dígitos, espacios, `-` y `+` inicial |
| `contrasena` | 10–128 caracteres, al menos una letra y un número |
| `motivo` (estado) | 5–255 caracteres |

## Archivos clave

- Dominio: `domain/entities/usuario.entity.ts`, `rol.entity.ts`; repositorios `usuarios.repository.ts`, `roles.repository.ts`; servicio `domain/services/hash_contrasena.service.ts` (contrato).
- Infraestructura: `prisma_usuarios.repository.ts`, `prisma_roles.repository.ts`, `argon2_hash_contrasena.service.ts` (Argon2id).
- El módulo **exporta** `UsuariosRepositorio` y `HashContrasena` (los usa `authentication`).

## Pruebas

`usuario.entity.spec.ts`, `crear_usuario`, `asignar_rol_usuario` y `cambiar_estado_usuario` (`*.use-case.spec.ts`). Dobles en `test/dobles/repositorios_memoria.ts` (`UsuariosMemoria`, `RolesMemoria`, `HashFalso`, `AuditoriaMemoria`, `crearUsuarioPrueba`, …).

## Seed

`prisma/seed.ts` sincroniza los 4 roles y crea el **administrador inicial** con `SEMILLA_ADMIN_CORREO` / `SEMILLA_ADMIN_CONTRASENA` si no existe (no modifica uno existente). Es idempotente.
