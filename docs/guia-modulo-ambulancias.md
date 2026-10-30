# Guía paso a paso — Módulo de Ambulancias

Esta guía te lleva a construir el módulo `ambulances` a mano, archivo por archivo, siguiendo las reglas de [`arquitectura.md`](arquitectura.md) y los mismos patrones del módulo `users`.

> Todo el código de esta guía ya se compiló, pasó el lint y las pruebas, y se probó contra MySQL. Si lo copias tal cual, funciona. Lo ideal es que lo **escribas** leyendo la explicación de cada paso: así entiendes por qué está hecho así.

**Cómo usar esta guía:** haz un paso, ejecuta el comando de verificación del final del paso y pasa al siguiente solo si no hay errores.

---

## Paso 0 — Qué vas a construir

### Endpoints

| Método | Ruta | Roles | Para qué |
| --- | --- | --- | --- |
| GET | `/tipos-ambulancia` | administrador, despachador | Opciones del select de tipo (TAB, TAM) |
| POST | `/ambulancias` | administrador | Registrar una ambulancia |
| GET | `/ambulancias` | administrador, despachador | Listar con filtros y paginación |
| GET | `/ambulancias/{id}` | administrador, despachador | Detalle |
| PATCH | `/ambulancias/{id}` | administrador | Editar código, placa o tipo |
| PATCH | `/ambulancias/{id}/estado` | administrador, despachador | Cambiar el estado operativo |
| GET | `/ambulancias/{id}/historial-estados` | administrador, despachador | Quién cambió el estado, cuándo y por qué |

### Reglas de negocio

1. **Código y placa son únicos.** Se normalizan antes de guardar: `amb-01` → `AMB-01` y `abc 123` / `abc-123` → `ABC123`. Así `ABC 123` y `abc-123` cuentan como la misma placa.
2. **Una ambulancia nueva nace `fuera_servicio`.** Se habilita después, cuando tenga tripulación.
3. **Transiciones de estado permitidas a mano** (arquitectura.md §9: *"Define transiciones válidas… Evita cambios arbitrarios de estado desde el cliente"*):

   | Desde \ Hacia | disponible | fuera_servicio | mantenimiento | en_servicio |
   | --- | --- | --- | --- | --- |
   | **disponible** | — | ✅ | ✅ | ❌ |
   | **fuera_servicio** | ✅ | — | ✅ | ❌ |
   | **mantenimiento** | ✅ | ✅ | — | ❌ |
   | **en_servicio** | ❌ | ❌ | ❌ | — |

   `en_servicio` **nunca** se pone a mano: lo pondrá el módulo de asignaciones cuando despache la ambulancia a una emergencia, y lo quitará al finalizar el servicio. Así nadie libera por error una ambulancia que está atendiendo un paciente.
4. **Cada cambio de estado queda en `estados_ambulancia_historial`** con el motivo y el usuario. El cambio y su historial se guardan en **una sola transacción**.
5. **Control de concurrencia:** si dos despachadores cambian el estado al mismo tiempo, el segundo recibe `409` en lugar de pisar el cambio del primero.
6. **No se edita una ambulancia `en_servicio`.**
7. Crear, editar y cambiar el estado quedan en **auditoría**.

### Estructura de archivos que vas a crear

```text
src/modules/ambulances/
├── domain/
│   ├── entities/
│   │   ├── tipo_ambulancia.entity.ts
│   │   ├── ambulancia.entity.ts
│   │   ├── ambulancia.entity.spec.ts
│   │   └── cambio_estado_ambulancia.entity.ts
│   └── repositories/
│       ├── tipos_ambulancia.repository.ts
│       └── ambulancias.repository.ts
├── application/
│   └── use-cases/
│       ├── consultar_tipos_ambulancia.use-case.ts
│       ├── crear_ambulancia.use-case.ts
│       ├── crear_ambulancia.use-case.spec.ts
│       ├── consultar_ambulancias.use-case.ts
│       ├── obtener_ambulancia.use-case.ts
│       ├── actualizar_ambulancia.use-case.ts
│       ├── cambiar_estado_ambulancia.use-case.ts
│       ├── cambiar_estado_ambulancia.use-case.spec.ts
│       └── consultar_historial_estados_ambulancia.use-case.ts
├── infrastructure/
│   └── repositories/
│       ├── prisma_tipos_ambulancia.repository.ts
│       └── prisma_ambulancias.repository.ts
├── presentation/
│   ├── controllers/
│   │   ├── tipos_ambulancia.controller.ts
│   │   └── ambulancias.controller.ts
│   └── dto/
│       ├── validaciones_ambulancia.ts
│       ├── tipo_ambulancia_respuesta.dto.ts
│       ├── crear_ambulancia.dto.ts
│       ├── actualizar_ambulancia.dto.ts
│       ├── cambiar_estado_ambulancia.dto.ts
│       ├── consultar_ambulancias.dto.ts
│       ├── ambulancia_respuesta.dto.ts
│       └── cambio_estado_respuesta.dto.ts
└── ambulances.module.ts

test/dobles/ambulancias_memoria.ts      ← dobles para las pruebas
```

Crea las carpetas (desde `back/api`):

```bash
mkdir -p src/modules/ambulances/{domain/{entities,repositories},application/use-cases,infrastructure/repositories,presentation/{controllers,dto}}
```

---

## Paso 1 — Base de datos

**No necesitas migración.** Las tablas `tipos_ambulancia`, `ambulancias` y `estados_ambulancia_historial` ya existen en la migración `inicial` y en `prisma/schema.prisma` (modelos `TipoAmbulancia`, `Ambulancia` y `EstadoAmbulanciaHistorial`). Revisa esos tres modelos en el schema antes de seguir.

Lo que falta son los **tipos de ambulancia** iniciales. Agrégalos al seed.

📄 `prisma/seed.ts`: pega esto **justo antes** de `async function sembrarAdministrador`:

```typescript
const TIPOS_AMBULANCIA_BASE: Record<string, string> = {
  TAB: 'Transporte Asistencial Básico',
  TAM: 'Transporte Asistencial Medicalizado',
};

async function sembrarTiposAmbulancia(): Promise<void> {
  for (const [nombre, descripcion] of Object.entries(TIPOS_AMBULANCIA_BASE)) {
    await prisma.tipoAmbulancia.upsert({
      where: { nombre },
      update: { descripcion },
      create: { id: crypto.randomUUID(), nombre, descripcion },
    });
  }
}
```

y en el bloque `try` del final llama la nueva función:

```typescript
try {
  await sembrarRoles();
  await sembrarTiposAmbulancia();
  await sembrarAdministrador();
} finally {
```

✅ **Verifica:**

```bash
npm run db:semilla
npx prisma studio      # abre la tabla tipos_ambulancia: deben estar TAB y TAM
```

---

## Paso 2 — Dominio: entidades

El dominio es TypeScript puro: **no importa NestJS ni Prisma** (arquitectura.md §4). Aquí viven las reglas del negocio.

### 2.1 Tipo de ambulancia

Es un catálogo sin comportamiento, así que basta con una interfaz.

📄 `src/modules/ambulances/domain/entities/tipo_ambulancia.entity.ts`

```typescript
export interface TipoAmbulancia {
  id: string;
  nombre: string;
  descripcion: string | null;
}
```

### 2.2 Ambulancia

Es una clase con constructor privado, igual que `Usuario`:
- `crear()` construye una ambulancia **nueva** y aplica las reglas de creación.
- `reconstruir()` la arma con datos que ya vienen de la base de datos.
- Las propiedades solo se leen con getters y solo cambian mediante métodos con reglas (`actualizarDatos`, `cambiarEstadoManual`).

Fíjate en `TRANSICIONES_MANUALES`: es la tabla del Paso 0 escrita en código.

📄 `src/modules/ambulances/domain/entities/ambulancia.entity.ts`

```typescript
import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type { TipoAmbulancia } from './tipo_ambulancia.entity.js';

export const ESTADOS_OPERATIVOS = [
  'disponible',
  'en_servicio',
  'fuera_servicio',
  'mantenimiento',
] as const;
export type EstadoOperativo = (typeof ESTADOS_OPERATIVOS)[number];

/** Estados que un usuario puede poner a mano. */
export const ESTADOS_MANUALES = [
  'disponible',
  'fuera_servicio',
  'mantenimiento',
] as const;
export type EstadoManual = (typeof ESTADOS_MANUALES)[number];

/**
 * `en_servicio` lo ponen y lo quitan las asignaciones, nunca un usuario:
 * así una ambulancia atendiendo una emergencia no se libera por error.
 */
const TRANSICIONES_MANUALES: Record<EstadoOperativo, readonly EstadoManual[]> =
  {
    disponible: ['fuera_servicio', 'mantenimiento'],
    fuera_servicio: ['disponible', 'mantenimiento'],
    mantenimiento: ['disponible', 'fuera_servicio'],
    en_servicio: [],
  };

export interface UbicacionAmbulancia {
  latitud: number;
  longitud: number;
  registradaEn: Date;
}

export interface PropiedadesAmbulancia {
  id: string;
  codigo: string;
  placa: string;
  tipo: TipoAmbulancia;
  estadoOperativo: EstadoOperativo;
  ultimaUbicacion: UbicacionAmbulancia | null;
  creadaEn: Date;
}

export interface DatosNuevaAmbulancia {
  codigo: string;
  placa: string;
  tipo: TipoAmbulancia;
}

export interface DatosEditablesAmbulancia {
  codigo?: string;
  placa?: string;
  tipo?: TipoAmbulancia;
}

export class Ambulancia {
  private constructor(private readonly propiedades: PropiedadesAmbulancia) {}

  static crear(datos: DatosNuevaAmbulancia): Ambulancia {
    return new Ambulancia({
      id: crypto.randomUUID(),
      codigo: Ambulancia.normalizarCodigo(datos.codigo),
      placa: Ambulancia.normalizarPlaca(datos.placa),
      tipo: datos.tipo,
      // Nace fuera de servicio: se habilita cuando tenga tripulación.
      estadoOperativo: 'fuera_servicio',
      ultimaUbicacion: null,
      creadaEn: new Date(),
    });
  }

  static reconstruir(propiedades: PropiedadesAmbulancia): Ambulancia {
    return new Ambulancia({ ...propiedades });
  }

  static normalizarCodigo(codigo: string): string {
    return codigo.trim().toUpperCase();
  }

  /** "abc-123" y "ABC 123" se guardan como "ABC123". */
  static normalizarPlaca(placa: string): string {
    return placa.replace(/[\s-]/g, '').toUpperCase();
  }

  static esEstadoValido(estado: string): estado is EstadoOperativo {
    return ESTADOS_OPERATIVOS.some((valido) => valido === estado);
  }

  get id(): string {
    return this.propiedades.id;
  }
  get codigo(): string {
    return this.propiedades.codigo;
  }
  get placa(): string {
    return this.propiedades.placa;
  }
  get tipo(): TipoAmbulancia {
    return this.propiedades.tipo;
  }
  get estadoOperativo(): EstadoOperativo {
    return this.propiedades.estadoOperativo;
  }
  get ultimaUbicacion(): UbicacionAmbulancia | null {
    return this.propiedades.ultimaUbicacion;
  }
  get creadaEn(): Date {
    return this.propiedades.creadaEn;
  }

  estaDisponible(): boolean {
    return this.propiedades.estadoOperativo === 'disponible';
  }

  actualizarDatos(datos: DatosEditablesAmbulancia): void {
    if (this.propiedades.estadoOperativo === 'en_servicio') {
      throw new ReglaNegocioError(
        'No se puede editar una ambulancia mientras está en servicio',
      );
    }
    if (datos.codigo !== undefined) {
      this.propiedades.codigo = Ambulancia.normalizarCodigo(datos.codigo);
    }
    if (datos.placa !== undefined) {
      this.propiedades.placa = Ambulancia.normalizarPlaca(datos.placa);
    }
    if (datos.tipo !== undefined) {
      this.propiedades.tipo = datos.tipo;
    }
  }

  cambiarEstadoManual(nuevo: EstadoManual): void {
    const actual = this.propiedades.estadoOperativo;
    if (actual === nuevo) {
      throw new ReglaNegocioError(`La ambulancia ya se encuentra ${nuevo}`);
    }
    if (!TRANSICIONES_MANUALES[actual].includes(nuevo)) {
      throw new ReglaNegocioError(
        `No se puede pasar de ${actual} a ${nuevo} manualmente`,
      );
    }
    this.propiedades.estadoOperativo = nuevo;
  }
}
```

### 2.3 Cambio de estado (historial)

📄 `src/modules/ambulances/domain/entities/cambio_estado_ambulancia.entity.ts`

```typescript
import type { EstadoOperativo } from './ambulancia.entity.js';

/** Fila de estados_ambulancia_historial: quién cambió el estado, cuándo y por qué. */
export interface CambioEstadoAmbulancia {
  id: string;
  ambulanciaId: string;
  estadoAnterior: EstadoOperativo | null;
  estadoNuevo: EstadoOperativo;
  motivo: string | null;
  usuarioId: string | null;
  cambiadoEn: Date;
}
```

---

## Paso 3 — Dominio: contratos de repositorio

Son **clases abstractas**, no interfaces, porque NestJS usa la clase como token de inyección. El caso de uso depende del contrato, y el módulo decide qué implementación (Prisma) se inyecta.

📄 `src/modules/ambulances/domain/repositories/tipos_ambulancia.repository.ts`

```typescript
import type { TipoAmbulancia } from '../entities/tipo_ambulancia.entity.js';

export abstract class TiposAmbulanciaRepositorio {
  abstract listar(): Promise<TipoAmbulancia[]>;
  abstract buscarPorId(id: string): Promise<TipoAmbulancia | null>;
}
```

📄 `src/modules/ambulances/domain/repositories/ambulancias.repository.ts`

```typescript
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type {
  Ambulancia,
  EstadoOperativo,
} from '../entities/ambulancia.entity.js';
import type { CambioEstadoAmbulancia } from '../entities/cambio_estado_ambulancia.entity.js';

export interface FiltrosAmbulancias {
  busqueda?: string;
  estadoOperativo?: EstadoOperativo;
  tipoAmbulanciaId?: string;
}

export abstract class AmbulanciasRepositorio {
  abstract buscarPorId(id: string): Promise<Ambulancia | null>;
  /** `excluirId` permite validar al editar sin chocar con la propia ambulancia. */
  abstract existeCodigo(codigo: string, excluirId?: string): Promise<boolean>;
  abstract existePlaca(placa: string, excluirId?: string): Promise<boolean>;
  abstract listar(
    filtros: FiltrosAmbulancias,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<Ambulancia>>;
  abstract crear(ambulancia: Ambulancia): Promise<Ambulancia>;
  /** Persiste código, placa y tipo. El estado se cambia con `cambiarEstado`. */
  abstract actualizar(ambulancia: Ambulancia): Promise<Ambulancia>;
  /**
   * Guarda el nuevo estado y su fila de historial en una sola transacción.
   * Falla si otro usuario cambió el estado mientras tanto.
   */
  abstract cambiarEstado(
    ambulancia: Ambulancia,
    cambio: CambioEstadoAmbulancia,
  ): Promise<Ambulancia>;
  abstract listarHistorialEstados(
    ambulanciaId: string,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<CambioEstadoAmbulancia>>;
}
```

---

## Paso 4 — Aplicación: casos de uso

Cada caso de uso tiene **una responsabilidad**: recibe un contrato de entrada propio (no el DTO HTTP), aplica las reglas, usa los repositorios y registra la auditoría.

### 4.1 Consultar tipos

📄 `src/modules/ambulances/application/use-cases/consultar_tipos_ambulancia.use-case.ts`

```typescript
import { Injectable } from '@nestjs/common';
import type { TipoAmbulancia } from '../../domain/entities/tipo_ambulancia.entity.js';
import { TiposAmbulanciaRepositorio } from '../../domain/repositories/tipos_ambulancia.repository.js';

@Injectable()
export class ConsultarTiposAmbulancia {
  constructor(
    private readonly tiposAmbulanciaRepositorio: TiposAmbulanciaRepositorio,
  ) {}

  ejecutar(): Promise<TipoAmbulancia[]> {
    return this.tiposAmbulanciaRepositorio.listar();
  }
}
```

### 4.2 Crear ambulancia

Primero normaliza con `Ambulancia.crear` y **después** valida que no exista. Si validaras antes, `abc 123` no chocaría con `ABC123`.

📄 `src/modules/ambulances/application/use-cases/crear_ambulancia.use-case.ts`

```typescript
import { Injectable } from '@nestjs/common';
import {
  ConflictoNegocioError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import { Ambulancia } from '../../domain/entities/ambulancia.entity.js';
import { AmbulanciasRepositorio } from '../../domain/repositories/ambulancias.repository.js';
import { TiposAmbulanciaRepositorio } from '../../domain/repositories/tipos_ambulancia.repository.js';

export interface CrearAmbulanciaEntrada {
  codigo: string;
  placa: string;
  tipoAmbulanciaId: string;
}

@Injectable()
export class CrearAmbulancia {
  constructor(
    private readonly ambulanciasRepositorio: AmbulanciasRepositorio,
    private readonly tiposAmbulanciaRepositorio: TiposAmbulanciaRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    datos: CrearAmbulanciaEntrada,
    contexto: ContextoSolicitud,
  ): Promise<Ambulancia> {
    const tipo = await this.tiposAmbulanciaRepositorio.buscarPorId(
      datos.tipoAmbulanciaId,
    );
    if (!tipo) throw new ReglaNegocioError('El tipo de ambulancia no existe');

    const nueva = Ambulancia.crear({
      codigo: datos.codigo,
      placa: datos.placa,
      tipo,
    });
    if (await this.ambulanciasRepositorio.existeCodigo(nueva.codigo)) {
      throw new ConflictoNegocioError(
        'Ya existe una ambulancia con ese código',
      );
    }
    if (await this.ambulanciasRepositorio.existePlaca(nueva.placa)) {
      throw new ConflictoNegocioError('Ya existe una ambulancia con esa placa');
    }

    const ambulancia = await this.ambulanciasRepositorio.crear(nueva);

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'ambulancias',
      entidadId: ambulancia.id,
      accion: 'crear',
      detalle: { codigo: ambulancia.codigo, placa: ambulancia.placa },
      direccionIp: contexto.direccionIp,
    });

    return ambulancia;
  }
}
```

### 4.3 Consultar y obtener

📄 `src/modules/ambulances/application/use-cases/consultar_ambulancias.use-case.ts`

```typescript
import { Injectable } from '@nestjs/common';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type { Ambulancia } from '../../domain/entities/ambulancia.entity.js';
import {
  AmbulanciasRepositorio,
  type FiltrosAmbulancias,
} from '../../domain/repositories/ambulancias.repository.js';

@Injectable()
export class ConsultarAmbulancias {
  constructor(
    private readonly ambulanciasRepositorio: AmbulanciasRepositorio,
  ) {}

  ejecutar(
    filtros: FiltrosAmbulancias,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<Ambulancia>> {
    return this.ambulanciasRepositorio.listar(filtros, paginacion);
  }
}
```

📄 `src/modules/ambulances/application/use-cases/obtener_ambulancia.use-case.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type { Ambulancia } from '../../domain/entities/ambulancia.entity.js';
import { AmbulanciasRepositorio } from '../../domain/repositories/ambulancias.repository.js';

@Injectable()
export class ObtenerAmbulancia {
  constructor(
    private readonly ambulanciasRepositorio: AmbulanciasRepositorio,
  ) {}

  async ejecutar(ambulanciaId: string): Promise<Ambulancia> {
    const ambulancia =
      await this.ambulanciasRepositorio.buscarPorId(ambulanciaId);
    if (!ambulancia) throw new RecursoNoEncontradoError('Ambulancia');
    return ambulancia;
  }
}
```

### 4.4 Actualizar

El segundo parámetro de `existeCodigo` y `existePlaca` (`ambulancia.id`) excluye a la propia ambulancia: si guardas sin cambiar la placa, no debe chocar consigo misma.

📄 `src/modules/ambulances/application/use-cases/actualizar_ambulancia.use-case.ts`

```typescript
import { Injectable } from '@nestjs/common';
import {
  ConflictoNegocioError,
  RecursoNoEncontradoError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type { Ambulancia } from '../../domain/entities/ambulancia.entity.js';
import type { TipoAmbulancia } from '../../domain/entities/tipo_ambulancia.entity.js';
import { AmbulanciasRepositorio } from '../../domain/repositories/ambulancias.repository.js';
import { TiposAmbulanciaRepositorio } from '../../domain/repositories/tipos_ambulancia.repository.js';

export interface ActualizarAmbulanciaEntrada {
  codigo?: string;
  placa?: string;
  tipoAmbulanciaId?: string;
}

@Injectable()
export class ActualizarAmbulancia {
  constructor(
    private readonly ambulanciasRepositorio: AmbulanciasRepositorio,
    private readonly tiposAmbulanciaRepositorio: TiposAmbulanciaRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    ambulanciaId: string,
    datos: ActualizarAmbulanciaEntrada,
    contexto: ContextoSolicitud,
  ): Promise<Ambulancia> {
    const ambulancia =
      await this.ambulanciasRepositorio.buscarPorId(ambulanciaId);
    if (!ambulancia) throw new RecursoNoEncontradoError('Ambulancia');

    let tipo: TipoAmbulancia | undefined;
    if (datos.tipoAmbulanciaId !== undefined) {
      const encontrado = await this.tiposAmbulanciaRepositorio.buscarPorId(
        datos.tipoAmbulanciaId,
      );
      if (!encontrado) {
        throw new ReglaNegocioError('El tipo de ambulancia no existe');
      }
      tipo = encontrado;
    }

    ambulancia.actualizarDatos({
      codigo: datos.codigo,
      placa: datos.placa,
      tipo,
    });

    if (
      await this.ambulanciasRepositorio.existeCodigo(
        ambulancia.codigo,
        ambulancia.id,
      )
    ) {
      throw new ConflictoNegocioError(
        'Ya existe una ambulancia con ese código',
      );
    }
    if (
      await this.ambulanciasRepositorio.existePlaca(
        ambulancia.placa,
        ambulancia.id,
      )
    ) {
      throw new ConflictoNegocioError('Ya existe una ambulancia con esa placa');
    }

    const actualizada =
      await this.ambulanciasRepositorio.actualizar(ambulancia);

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'ambulancias',
      entidadId: ambulancia.id,
      accion: 'actualizar',
      detalle: { campos: Object.keys(datos) },
      direccionIp: contexto.direccionIp,
    });

    return actualizada;
  }
}
```

### 4.5 Cambiar estado

La entidad valida la transición (`cambiarEstadoManual`) y el repositorio guarda el estado y el historial en una transacción.

📄 `src/modules/ambulances/application/use-cases/cambiar_estado_ambulancia.use-case.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { AuditoriaRepositorio } from '../../../audit/domain/repositories/auditoria.repository.js';
import type {
  Ambulancia,
  EstadoManual,
} from '../../domain/entities/ambulancia.entity.js';
import { AmbulanciasRepositorio } from '../../domain/repositories/ambulancias.repository.js';

export interface CambiarEstadoAmbulanciaEntrada {
  ambulanciaId: string;
  estado: EstadoManual;
  motivo: string;
}

@Injectable()
export class CambiarEstadoAmbulancia {
  constructor(
    private readonly ambulanciasRepositorio: AmbulanciasRepositorio,
    private readonly auditoria: AuditoriaRepositorio,
  ) {}

  async ejecutar(
    datos: CambiarEstadoAmbulanciaEntrada,
    contexto: ContextoSolicitud,
  ): Promise<Ambulancia> {
    const ambulancia = await this.ambulanciasRepositorio.buscarPorId(
      datos.ambulanciaId,
    );
    if (!ambulancia) throw new RecursoNoEncontradoError('Ambulancia');

    const estadoAnterior = ambulancia.estadoOperativo;
    ambulancia.cambiarEstadoManual(datos.estado);

    const actualizada = await this.ambulanciasRepositorio.cambiarEstado(
      ambulancia,
      {
        id: crypto.randomUUID(),
        ambulanciaId: ambulancia.id,
        estadoAnterior,
        estadoNuevo: datos.estado,
        motivo: datos.motivo,
        usuarioId: contexto.usuarioId,
        cambiadoEn: new Date(),
      },
    );

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      entidad: 'ambulancias',
      entidadId: ambulancia.id,
      accion: 'cambiar_estado',
      detalle: { estadoAnterior, estadoNuevo: datos.estado },
      direccionIp: contexto.direccionIp,
    });

    return actualizada;
  }
}
```

### 4.6 Historial de estados

📄 `src/modules/ambulances/application/use-cases/consultar_historial_estados_ambulancia.use-case.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { RecursoNoEncontradoError } from '../../../../common/exceptions/errores_dominio.js';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import type { CambioEstadoAmbulancia } from '../../domain/entities/cambio_estado_ambulancia.entity.js';
import { AmbulanciasRepositorio } from '../../domain/repositories/ambulancias.repository.js';

@Injectable()
export class ConsultarHistorialEstadosAmbulancia {
  constructor(
    private readonly ambulanciasRepositorio: AmbulanciasRepositorio,
  ) {}

  async ejecutar(
    ambulanciaId: string,
    paginacion: Paginacion,
  ): Promise<ResultadoPaginado<CambioEstadoAmbulancia>> {
    const ambulancia =
      await this.ambulanciasRepositorio.buscarPorId(ambulanciaId);
    if (!ambulancia) throw new RecursoNoEncontradoError('Ambulancia');

    return this.ambulanciasRepositorio.listarHistorialEstados(
      ambulanciaId,
      paginacion,
    );
  }
}
```

✅ **Verifica** que el dominio y la aplicación compilan:

```bash
npm run typecheck
```

---

## Paso 5 — Infraestructura: repositorios con Prisma

Es la **única** capa que conoce Prisma (arquitectura.md §6). Tres puntos importantes:

- **`select` explícito:** se piden solo los campos necesarios, con `satisfies Prisma.AmbulanciaSelect` para que TypeScript te avise si escribes mal un campo.
- **`Decimal` → `number`:** MySQL devuelve las coordenadas como objetos `Decimal` y el dominio trabaja con `number`.
- **`cambiarEstado` usa `updateMany` con `where: { id, estadoOperativo: estadoAnterior }`.** Si otro usuario cambió el estado entre la lectura y la escritura, no se actualiza ninguna fila (`count === 0`) y se responde `409`. Eso es el control de concurrencia de la regla 5.

📄 `src/modules/ambulances/infrastructure/repositories/prisma_tipos_ambulancia.repository.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service.js';
import type { TipoAmbulancia } from '../../domain/entities/tipo_ambulancia.entity.js';
import { TiposAmbulanciaRepositorio } from '../../domain/repositories/tipos_ambulancia.repository.js';

const seleccionTipo = { id: true, nombre: true, descripcion: true } as const;

@Injectable()
export class PrismaTiposAmbulanciaRepositorio extends TiposAmbulanciaRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  listar(): Promise<TipoAmbulancia[]> {
    return this.prisma.tipoAmbulancia.findMany({
      select: seleccionTipo,
      orderBy: { nombre: 'asc' },
    });
  }

  buscarPorId(id: string): Promise<TipoAmbulancia | null> {
    return this.prisma.tipoAmbulancia.findUnique({
      where: { id },
      select: seleccionTipo,
    });
  }
}
```

📄 `src/modules/ambulances/infrastructure/repositories/prisma_ambulancias.repository.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { ConflictoNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import { PrismaService } from '../../../../database/prisma.service.js';
import { Prisma } from '../../../../generated/prisma/client.js';
import {
  Ambulancia,
  type EstadoOperativo,
} from '../../domain/entities/ambulancia.entity.js';
import type { CambioEstadoAmbulancia } from '../../domain/entities/cambio_estado_ambulancia.entity.js';
import {
  AmbulanciasRepositorio,
  type FiltrosAmbulancias,
} from '../../domain/repositories/ambulancias.repository.js';

const seleccionAmbulancia = {
  id: true,
  codigo: true,
  placa: true,
  estadoOperativo: true,
  ultimaLatitud: true,
  ultimaLongitud: true,
  ultimaUbicacionEn: true,
  creadaEn: true,
  tipoAmbulancia: { select: { id: true, nombre: true, descripcion: true } },
} satisfies Prisma.AmbulanciaSelect;

type RegistroAmbulancia = Prisma.AmbulanciaGetPayload<{
  select: typeof seleccionAmbulancia;
}>;

const seleccionCambioEstado = {
  id: true,
  ambulanciaId: true,
  estadoAnterior: true,
  estadoNuevo: true,
  motivo: true,
  usuarioId: true,
  cambiadoEn: true,
} satisfies Prisma.EstadoAmbulanciaHistorialSelect;

type RegistroCambioEstado = Prisma.EstadoAmbulanciaHistorialGetPayload<{
  select: typeof seleccionCambioEstado;
}>;

@Injectable()
export class PrismaAmbulanciasRepositorio extends AmbulanciasRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async buscarPorId(id: string): Promise<Ambulancia | null> {
    const registro = await this.prisma.ambulancia.findUnique({
      where: { id },
      select: seleccionAmbulancia,
    });
    return registro ? this.aEntidad(registro) : null;
  }

  async existeCodigo(codigo: string, excluirId?: string): Promise<boolean> {
    const total = await this.prisma.ambulancia.count({
      where: { codigo, id: excluirId ? { not: excluirId } : undefined },
    });
    return total > 0;
  }

  async existePlaca(placa: string, excluirId?: string): Promise<boolean> {
    const total = await this.prisma.ambulancia.count({
      where: { placa, id: excluirId ? { not: excluirId } : undefined },
    });
    return total > 0;
  }

  async listar(
    filtros: FiltrosAmbulancias,
    { pagina, limite }: Paginacion,
  ): Promise<ResultadoPaginado<Ambulancia>> {
    const where: Prisma.AmbulanciaWhereInput = {
      estadoOperativo: filtros.estadoOperativo,
      tipoAmbulanciaId: filtros.tipoAmbulanciaId,
      OR: filtros.busqueda
        ? [
            { codigo: { contains: filtros.busqueda } },
            { placa: { contains: filtros.busqueda } },
          ]
        : undefined,
    };

    const [total, registros] = await this.prisma.$transaction([
      this.prisma.ambulancia.count({ where }),
      this.prisma.ambulancia.findMany({
        where,
        select: seleccionAmbulancia,
        orderBy: { codigo: 'asc' },
        skip: (pagina - 1) * limite,
        take: limite,
      }),
    ]);

    return {
      datos: registros.map((registro) => this.aEntidad(registro)),
      total,
      pagina,
      limite,
    };
  }

  async crear(ambulancia: Ambulancia): Promise<Ambulancia> {
    try {
      const registro = await this.prisma.ambulancia.create({
        data: {
          id: ambulancia.id,
          codigo: ambulancia.codigo,
          placa: ambulancia.placa,
          estadoOperativo: ambulancia.estadoOperativo,
          creadaEn: ambulancia.creadaEn,
          tipoAmbulancia: { connect: { id: ambulancia.tipo.id } },
        },
        select: seleccionAmbulancia,
      });
      return this.aEntidad(registro);
    } catch (error) {
      throw this.traducirError(error);
    }
  }

  async actualizar(ambulancia: Ambulancia): Promise<Ambulancia> {
    try {
      const registro = await this.prisma.ambulancia.update({
        where: { id: ambulancia.id },
        data: {
          codigo: ambulancia.codigo,
          placa: ambulancia.placa,
          tipoAmbulancia: { connect: { id: ambulancia.tipo.id } },
        },
        select: seleccionAmbulancia,
      });
      return this.aEntidad(registro);
    } catch (error) {
      throw this.traducirError(error);
    }
  }

  async cambiarEstado(
    ambulancia: Ambulancia,
    cambio: CambioEstadoAmbulancia,
  ): Promise<Ambulancia> {
    const registro = await this.prisma.$transaction(async (tx) => {
      // Solo actualiza si el estado sigue siendo el que se leyó: si otro
      // usuario lo cambió entre la lectura y la escritura, no se pisa.
      const { count } = await tx.ambulancia.updateMany({
        where: {
          id: ambulancia.id,
          estadoOperativo: cambio.estadoAnterior ?? undefined,
        },
        data: { estadoOperativo: cambio.estadoNuevo },
      });
      if (count === 0) {
        throw new ConflictoNegocioError(
          'El estado de la ambulancia cambió mientras tanto; vuelva a consultarla',
        );
      }

      await tx.estadoAmbulanciaHistorial.create({
        data: {
          id: cambio.id,
          ambulanciaId: cambio.ambulanciaId,
          estadoAnterior: cambio.estadoAnterior,
          estadoNuevo: cambio.estadoNuevo,
          motivo: cambio.motivo,
          usuarioId: cambio.usuarioId,
          cambiadoEn: cambio.cambiadoEn,
        },
      });

      return tx.ambulancia.findUniqueOrThrow({
        where: { id: ambulancia.id },
        select: seleccionAmbulancia,
      });
    });
    return this.aEntidad(registro);
  }

  async listarHistorialEstados(
    ambulanciaId: string,
    { pagina, limite }: Paginacion,
  ): Promise<ResultadoPaginado<CambioEstadoAmbulancia>> {
    const where = { ambulanciaId };
    const [total, registros] = await this.prisma.$transaction([
      this.prisma.estadoAmbulanciaHistorial.count({ where }),
      this.prisma.estadoAmbulanciaHistorial.findMany({
        where,
        select: seleccionCambioEstado,
        orderBy: { cambiadoEn: 'desc' },
        skip: (pagina - 1) * limite,
        take: limite,
      }),
    ]);

    return {
      datos: registros.map((registro) => this.aCambioEstado(registro)),
      total,
      pagina,
      limite,
    };
  }

  private aEntidad(registro: RegistroAmbulancia): Ambulancia {
    const { ultimaLatitud, ultimaLongitud, ultimaUbicacionEn } = registro;

    return Ambulancia.reconstruir({
      id: registro.id,
      codigo: registro.codigo,
      placa: registro.placa,
      tipo: registro.tipoAmbulancia,
      estadoOperativo: this.validarEstado(registro.estadoOperativo),
      // MySQL devuelve DECIMAL como objeto Decimal; el dominio usa number.
      ultimaUbicacion:
        ultimaLatitud !== null &&
        ultimaLongitud !== null &&
        ultimaUbicacionEn !== null
          ? {
              latitud: ultimaLatitud.toNumber(),
              longitud: ultimaLongitud.toNumber(),
              registradaEn: ultimaUbicacionEn,
            }
          : null,
      creadaEn: registro.creadaEn,
    });
  }

  private aCambioEstado(
    registro: RegistroCambioEstado,
  ): CambioEstadoAmbulancia {
    return {
      ...registro,
      estadoAnterior:
        registro.estadoAnterior === null
          ? null
          : this.validarEstado(registro.estadoAnterior),
      estadoNuevo: this.validarEstado(registro.estadoNuevo),
    };
  }

  private validarEstado(estado: string): EstadoOperativo {
    if (!Ambulancia.esEstadoValido(estado)) {
      throw new Error(
        `Estado de ambulancia desconocido en la base de datos: ${estado}`,
      );
    }
    return estado;
  }

  private traducirError(error: unknown): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictoNegocioError(
        'Ya existe una ambulancia con ese código o placa',
      );
    }
    return error;
  }
}
```

---

## Paso 6 — Presentación: DTOs

Los DTOs **validan la entrada HTTP** (class-validator) y **documentan Swagger**. Recuerda que `main.ts` tiene `forbidNonWhitelisted`, así que cualquier campo que no esté en el DTO devuelve `400`.

### 6.1 Validaciones compartidas

📄 `src/modules/ambulances/presentation/dto/validaciones_ambulancia.ts`

```typescript
/** Reglas compartidas entre los DTO de ambulancias. */
export const PATRON_CODIGO_AMBULANCIA = /^[A-Za-z0-9-]{2,30}$/;

/** Placa colombiana de vehículo: 3 letras y 3 números, con espacio o guion opcional. */
export const PATRON_PLACA = /^[A-Za-z]{3}[\s-]?\d{3}$/;
```

### 6.2 DTOs de entrada

Fíjate en que `CambiarEstadoAmbulanciaDto` usa `ESTADOS_MANUALES`: si alguien envía `en_servicio`, la API responde `400` antes de llegar al caso de uso.

📄 `src/modules/ambulances/presentation/dto/crear_ambulancia.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, Matches } from 'class-validator';
import {
  PATRON_CODIGO_AMBULANCIA,
  PATRON_PLACA,
} from './validaciones_ambulancia.js';

export class CrearAmbulanciaDto {
  @ApiProperty({
    description: 'Código interno único; se guarda en mayúsculas',
    example: 'AMB-01',
  })
  @Matches(PATRON_CODIGO_AMBULANCIA, {
    message: 'El código solo admite letras, números y guiones (2 a 30)',
  })
  codigo: string;

  @ApiProperty({
    description: 'Placa única; se guarda sin espacios ni guiones',
    example: 'ABC123',
  })
  @Matches(PATRON_PLACA, { message: 'La placa debe tener el formato ABC123' })
  placa: string;

  @ApiProperty({ format: 'uuid', description: 'Id de GET /tipos-ambulancia' })
  @IsUUID()
  tipoAmbulanciaId: string;
}
```

📄 `src/modules/ambulances/presentation/dto/actualizar_ambulancia.dto.ts`

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, Matches } from 'class-validator';
import {
  PATRON_CODIGO_AMBULANCIA,
  PATRON_PLACA,
} from './validaciones_ambulancia.js';

/** El estado operativo no se cambia aquí: tiene su propio endpoint. */
export class ActualizarAmbulanciaDto {
  @ApiPropertyOptional({ example: 'AMB-01' })
  @IsOptional()
  @Matches(PATRON_CODIGO_AMBULANCIA, {
    message: 'El código solo admite letras, números y guiones (2 a 30)',
  })
  codigo?: string;

  @ApiPropertyOptional({ example: 'ABC123' })
  @IsOptional()
  @Matches(PATRON_PLACA, { message: 'La placa debe tener el formato ABC123' })
  placa?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  tipoAmbulanciaId?: string;
}
```

📄 `src/modules/ambulances/presentation/dto/cambiar_estado_ambulancia.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import {
  ESTADOS_MANUALES,
  type EstadoManual,
} from '../../domain/entities/ambulancia.entity.js';

export class CambiarEstadoAmbulanciaDto {
  @ApiProperty({
    enum: ESTADOS_MANUALES,
    description:
      'en_servicio no se puede poner a mano: lo asignan los servicios',
  })
  @IsIn(ESTADOS_MANUALES)
  estado: EstadoManual;

  @ApiProperty({
    description: 'Justificación; queda en el historial de estados',
    minLength: 5,
    maxLength: 255,
  })
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  motivo: string;
}
```

📄 `src/modules/ambulances/presentation/dto/consultar_ambulancias.dto.ts`

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginacionDto } from '../../../../common/dto/paginacion.dto.js';
import {
  ESTADOS_OPERATIVOS,
  type EstadoOperativo,
} from '../../domain/entities/ambulancia.entity.js';

export class ConsultarAmbulanciasDto extends PaginacionDto {
  @ApiPropertyOptional({ description: 'Busca en código o placa' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  busqueda?: string;

  @ApiPropertyOptional({ enum: ESTADOS_OPERATIVOS })
  @IsOptional()
  @IsIn(ESTADOS_OPERATIVOS)
  estadoOperativo?: EstadoOperativo;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  tipoAmbulanciaId?: string;
}
```

### 6.3 DTOs de respuesta

Nunca se devuelve la entidad ni el registro de Prisma directamente (arquitectura.md §5.6). Cada DTO de respuesta tiene un método `desde()` que decide qué se expone.

📄 `src/modules/ambulances/presentation/dto/tipo_ambulancia_respuesta.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { TipoAmbulancia } from '../../domain/entities/tipo_ambulancia.entity.js';

export class TipoAmbulanciaRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'TAB' })
  nombre: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Básica' })
  descripcion: string | null;

  static desde(tipo: TipoAmbulancia): TipoAmbulanciaRespuestaDto {
    return { id: tipo.id, nombre: tipo.nombre, descripcion: tipo.descripcion };
  }
}
```

📄 `src/modules/ambulances/presentation/dto/ambulancia_respuesta.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ResultadoPaginado } from '../../../../common/types/resultado_paginado.js';
import {
  type Ambulancia,
  ESTADOS_OPERATIVOS,
  type EstadoOperativo,
} from '../../domain/entities/ambulancia.entity.js';
import { TipoAmbulanciaRespuestaDto } from './tipo_ambulancia_respuesta.dto.js';

export class UbicacionRespuestaDto {
  @ApiProperty({ example: 4.6097102 })
  latitud: number;

  @ApiProperty({ example: -74.081749 })
  longitud: number;

  @ApiProperty()
  registradaEn: Date;
}

export class AmbulanciaRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'AMB-01' })
  codigo: string;

  @ApiProperty({ example: 'ABC123' })
  placa: string;

  @ApiProperty({ type: TipoAmbulanciaRespuestaDto })
  tipo: TipoAmbulanciaRespuestaDto;

  @ApiProperty({ enum: ESTADOS_OPERATIVOS })
  estadoOperativo: EstadoOperativo;

  @ApiPropertyOptional({ type: UbicacionRespuestaDto, nullable: true })
  ultimaUbicacion: UbicacionRespuestaDto | null;

  @ApiProperty()
  creadaEn: Date;

  static desde(ambulancia: Ambulancia): AmbulanciaRespuestaDto {
    return {
      id: ambulancia.id,
      codigo: ambulancia.codigo,
      placa: ambulancia.placa,
      tipo: TipoAmbulanciaRespuestaDto.desde(ambulancia.tipo),
      estadoOperativo: ambulancia.estadoOperativo,
      ultimaUbicacion: ambulancia.ultimaUbicacion,
      creadaEn: ambulancia.creadaEn,
    };
  }
}

export class AmbulanciasPaginadasRespuestaDto {
  @ApiProperty({ type: [AmbulanciaRespuestaDto] })
  datos: AmbulanciaRespuestaDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  pagina: number;

  @ApiProperty()
  limite: number;

  static desde(
    resultado: ResultadoPaginado<Ambulancia>,
  ): AmbulanciasPaginadasRespuestaDto {
    return {
      ...resultado,
      datos: resultado.datos.map((ambulancia) =>
        AmbulanciaRespuestaDto.desde(ambulancia),
      ),
    };
  }
}
```

📄 `src/modules/ambulances/presentation/dto/cambio_estado_respuesta.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ResultadoPaginado } from '../../../../common/types/resultado_paginado.js';
import {
  ESTADOS_OPERATIVOS,
  type EstadoOperativo,
} from '../../domain/entities/ambulancia.entity.js';
import type { CambioEstadoAmbulancia } from '../../domain/entities/cambio_estado_ambulancia.entity.js';

export class CambioEstadoRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiPropertyOptional({ enum: ESTADOS_OPERATIVOS, nullable: true })
  estadoAnterior: EstadoOperativo | null;

  @ApiProperty({ enum: ESTADOS_OPERATIVOS })
  estadoNuevo: EstadoOperativo;

  @ApiPropertyOptional({ type: String, nullable: true })
  motivo: string | null;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  usuarioId: string | null;

  @ApiProperty()
  cambiadoEn: Date;

  static desde(cambio: CambioEstadoAmbulancia): CambioEstadoRespuestaDto {
    return {
      id: cambio.id,
      estadoAnterior: cambio.estadoAnterior,
      estadoNuevo: cambio.estadoNuevo,
      motivo: cambio.motivo,
      usuarioId: cambio.usuarioId,
      cambiadoEn: cambio.cambiadoEn,
    };
  }
}

export class HistorialEstadosRespuestaDto {
  @ApiProperty({ type: [CambioEstadoRespuestaDto] })
  datos: CambioEstadoRespuestaDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  pagina: number;

  @ApiProperty()
  limite: number;

  static desde(
    resultado: ResultadoPaginado<CambioEstadoAmbulancia>,
  ): HistorialEstadosRespuestaDto {
    return {
      ...resultado,
      datos: resultado.datos.map((cambio) =>
        CambioEstadoRespuestaDto.desde(cambio),
      ),
    };
  }
}
```

---

## Paso 7 — Presentación: controladores

Los controladores son **delgados**: reciben el DTO, llaman al caso de uso y convierten la respuesta. Sin reglas de negocio y sin Prisma. Los permisos se declaran con `@RequiereRoles(...)`.

📄 `src/modules/ambulances/presentation/controllers/tipos_ambulancia.controller.ts`

```typescript
import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../../../common/constants/roles.js';
import { RequiereRoles } from '../../../../common/decorators/requiere_roles.decorator.js';
import { ConsultarTiposAmbulancia } from '../../application/use-cases/consultar_tipos_ambulancia.use-case.js';
import { TipoAmbulanciaRespuestaDto } from '../dto/tipo_ambulancia_respuesta.dto.js';

@ApiTags('Ambulancias')
@ApiBearerAuth()
@Controller('tipos-ambulancia')
export class TiposAmbulanciaController {
  constructor(
    private readonly consultarTiposAmbulancia: ConsultarTiposAmbulancia,
  ) {}

  @Get()
  @RequiereRoles(Roles.ADMINISTRADOR, Roles.DESPACHADOR)
  @ApiOperation({ summary: 'Listar los tipos de ambulancia (TAB, TAM)' })
  @ApiOkResponse({ type: [TipoAmbulanciaRespuestaDto] })
  async listar(): Promise<TipoAmbulanciaRespuestaDto[]> {
    const tipos = await this.consultarTiposAmbulancia.ejecutar();
    return tipos.map((tipo) => TipoAmbulanciaRespuestaDto.desde(tipo));
  }
}
```

📄 `src/modules/ambulances/presentation/controllers/ambulancias.controller.ts`

```typescript
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { PaginacionDto } from '../../../../common/dto/paginacion.dto.js';
import { Roles } from '../../../../common/constants/roles.js';
import { Contexto } from '../../../../common/decorators/contexto.decorator.js';
import { RequiereRoles } from '../../../../common/decorators/requiere_roles.decorator.js';
import type { ContextoSolicitud } from '../../../../common/types/contexto_solicitud.js';
import { ActualizarAmbulancia } from '../../application/use-cases/actualizar_ambulancia.use-case.js';
import { CambiarEstadoAmbulancia } from '../../application/use-cases/cambiar_estado_ambulancia.use-case.js';
import { ConsultarAmbulancias } from '../../application/use-cases/consultar_ambulancias.use-case.js';
import { ConsultarHistorialEstadosAmbulancia } from '../../application/use-cases/consultar_historial_estados_ambulancia.use-case.js';
import { CrearAmbulancia } from '../../application/use-cases/crear_ambulancia.use-case.js';
import { ObtenerAmbulancia } from '../../application/use-cases/obtener_ambulancia.use-case.js';
import { ActualizarAmbulanciaDto } from '../dto/actualizar_ambulancia.dto.js';
import {
  AmbulanciaRespuestaDto,
  AmbulanciasPaginadasRespuestaDto,
} from '../dto/ambulancia_respuesta.dto.js';
import { CambiarEstadoAmbulanciaDto } from '../dto/cambiar_estado_ambulancia.dto.js';
import { HistorialEstadosRespuestaDto } from '../dto/cambio_estado_respuesta.dto.js';
import { ConsultarAmbulanciasDto } from '../dto/consultar_ambulancias.dto.js';
import { CrearAmbulanciaDto } from '../dto/crear_ambulancia.dto.js';

@ApiTags('Ambulancias')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado' })
@ApiForbiddenResponse({ description: 'Sin permisos para la operación' })
@Controller('ambulancias')
export class AmbulanciasController {
  constructor(
    private readonly crearAmbulancia: CrearAmbulancia,
    private readonly consultarAmbulancias: ConsultarAmbulancias,
    private readonly obtenerAmbulancia: ObtenerAmbulancia,
    private readonly actualizarAmbulancia: ActualizarAmbulancia,
    private readonly cambiarEstadoAmbulancia: CambiarEstadoAmbulancia,
    private readonly consultarHistorialEstados: ConsultarHistorialEstadosAmbulancia,
  ) {}

  @Post()
  @RequiereRoles(Roles.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Registrar una ambulancia (nace fuera de servicio)',
  })
  @ApiCreatedResponse({ type: AmbulanciaRespuestaDto })
  @ApiConflictResponse({ description: 'Código o placa ya registrados' })
  @ApiUnprocessableEntityResponse({
    description: 'Tipo de ambulancia inexistente',
  })
  async crear(
    @Body() dto: CrearAmbulanciaDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<AmbulanciaRespuestaDto> {
    const ambulancia = await this.crearAmbulancia.ejecutar(dto, contexto);
    return AmbulanciaRespuestaDto.desde(ambulancia);
  }

  @Get()
  @RequiereRoles(Roles.ADMINISTRADOR, Roles.DESPACHADOR)
  @ApiOperation({ summary: 'Consultar ambulancias con filtros y paginación' })
  @ApiOkResponse({ type: AmbulanciasPaginadasRespuestaDto })
  async consultar(
    @Query() { pagina, limite, ...filtros }: ConsultarAmbulanciasDto,
  ): Promise<AmbulanciasPaginadasRespuestaDto> {
    const resultado = await this.consultarAmbulancias.ejecutar(filtros, {
      pagina,
      limite,
    });
    return AmbulanciasPaginadasRespuestaDto.desde(resultado);
  }

  @Get(':id')
  @RequiereRoles(Roles.ADMINISTRADOR, Roles.DESPACHADOR)
  @ApiOperation({ summary: 'Obtener una ambulancia' })
  @ApiOkResponse({ type: AmbulanciaRespuestaDto })
  @ApiNotFoundResponse()
  async obtener(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AmbulanciaRespuestaDto> {
    return AmbulanciaRespuestaDto.desde(
      await this.obtenerAmbulancia.ejecutar(id),
    );
  }

  @Patch(':id')
  @RequiereRoles(Roles.ADMINISTRADOR)
  @ApiOperation({ summary: 'Editar código, placa o tipo de una ambulancia' })
  @ApiOkResponse({ type: AmbulanciaRespuestaDto })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Código o placa ya registrados' })
  @ApiUnprocessableEntityResponse({
    description: 'Ambulancia en servicio o tipo inexistente',
  })
  async actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarAmbulanciaDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<AmbulanciaRespuestaDto> {
    const ambulancia = await this.actualizarAmbulancia.ejecutar(
      id,
      dto,
      contexto,
    );
    return AmbulanciaRespuestaDto.desde(ambulancia);
  }

  @Patch(':id/estado')
  @RequiereRoles(Roles.ADMINISTRADOR, Roles.DESPACHADOR)
  @ApiOperation({
    summary:
      'Cambiar el estado operativo (disponible, fuera de servicio, mantenimiento)',
  })
  @ApiOkResponse({ type: AmbulanciaRespuestaDto })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Otro usuario cambió el estado antes' })
  @ApiUnprocessableEntityResponse({ description: 'Transición no permitida' })
  async cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoAmbulanciaDto,
    @Contexto() contexto: ContextoSolicitud,
  ): Promise<AmbulanciaRespuestaDto> {
    const ambulancia = await this.cambiarEstadoAmbulancia.ejecutar(
      { ambulanciaId: id, estado: dto.estado, motivo: dto.motivo },
      contexto,
    );
    return AmbulanciaRespuestaDto.desde(ambulancia);
  }

  @Get(':id/historial-estados')
  @RequiereRoles(Roles.ADMINISTRADOR, Roles.DESPACHADOR)
  @ApiOperation({
    summary: 'Historial de cambios de estado, del más reciente al más antiguo',
  })
  @ApiOkResponse({ type: HistorialEstadosRespuestaDto })
  @ApiNotFoundResponse()
  async historialEstados(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() paginacion: PaginacionDto,
  ): Promise<HistorialEstadosRespuestaDto> {
    const resultado = await this.consultarHistorialEstados.ejecutar(id, {
      pagina: paginacion.pagina,
      limite: paginacion.limite,
    });
    return HistorialEstadosRespuestaDto.desde(resultado);
  }
}
```

---

## Paso 8 — Módulo y registro en la app

El módulo conecta todo: le dice a NestJS que cuando un caso de uso pida `AmbulanciasRepositorio`, inyecte `PrismaAmbulanciasRepositorio`. Exporta `AmbulanciasRepositorio` porque el futuro módulo de asignaciones lo va a necesitar.

📄 `src/modules/ambulances/ambulances.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { ActualizarAmbulancia } from './application/use-cases/actualizar_ambulancia.use-case.js';
import { CambiarEstadoAmbulancia } from './application/use-cases/cambiar_estado_ambulancia.use-case.js';
import { ConsultarAmbulancias } from './application/use-cases/consultar_ambulancias.use-case.js';
import { ConsultarHistorialEstadosAmbulancia } from './application/use-cases/consultar_historial_estados_ambulancia.use-case.js';
import { ConsultarTiposAmbulancia } from './application/use-cases/consultar_tipos_ambulancia.use-case.js';
import { CrearAmbulancia } from './application/use-cases/crear_ambulancia.use-case.js';
import { ObtenerAmbulancia } from './application/use-cases/obtener_ambulancia.use-case.js';
import { AmbulanciasRepositorio } from './domain/repositories/ambulancias.repository.js';
import { TiposAmbulanciaRepositorio } from './domain/repositories/tipos_ambulancia.repository.js';
import { PrismaAmbulanciasRepositorio } from './infrastructure/repositories/prisma_ambulancias.repository.js';
import { PrismaTiposAmbulanciaRepositorio } from './infrastructure/repositories/prisma_tipos_ambulancia.repository.js';
import { AmbulanciasController } from './presentation/controllers/ambulancias.controller.js';
import { TiposAmbulanciaController } from './presentation/controllers/tipos_ambulancia.controller.js';

@Module({
  imports: [AuditModule],
  controllers: [AmbulanciasController, TiposAmbulanciaController],
  providers: [
    { provide: AmbulanciasRepositorio, useClass: PrismaAmbulanciasRepositorio },
    {
      provide: TiposAmbulanciaRepositorio,
      useClass: PrismaTiposAmbulanciaRepositorio,
    },
    CrearAmbulancia,
    ConsultarAmbulancias,
    ObtenerAmbulancia,
    ActualizarAmbulancia,
    CambiarEstadoAmbulancia,
    ConsultarHistorialEstadosAmbulancia,
    ConsultarTiposAmbulancia,
  ],
  exports: [AmbulanciasRepositorio],
})
export class AmbulancesModule {}
```

📄 `src/app.module.ts`: importa el módulo y agrégalo a `imports`:

```typescript
import { AmbulancesModule } from './modules/ambulances/ambulances.module.js';
// ...
  imports: [
    // ...lo que ya está
    AuthenticationModule,
    AmbulancesModule,
  ],
```

✅ **Verifica:**

```bash
npm run typecheck
npm run lint
npm run start:dev
```

---

## Paso 9 — Probar en Swagger

Abre `http://localhost:3000/api/docs`, inicia sesión con el administrador, pulsa **Authorize** y prueba este flujo en orden:

1. **GET `/tipos-ambulancia`** → copia el `id` de TAM.
2. **POST `/ambulancias`**:
   ```json
   { "codigo": "amb-01", "placa": "abc-123", "tipoAmbulanciaId": "<id de TAM>" }
   ```
   Esperado: **201**, con `codigo: "AMB-01"`, `placa: "ABC123"` y `estadoOperativo: "fuera_servicio"`.
3. **POST `/ambulancias`** de nuevo con `"codigo": "amb-02", "placa": "ABC 123"` → **409** "Ya existe una ambulancia con esa placa".
4. **PATCH `/ambulancias/{id}/estado`** con `{ "estado": "disponible", "motivo": "Inicio de turno" }` → **200**, `disponible`.
5. Lo mismo con `"estado": "en_servicio"` → **400** (no se permite a mano).
6. Lo mismo con `"estado": "disponible"` otra vez → **422** "La ambulancia ya se encuentra disponible".
7. **PATCH `/ambulancias/{id}`** con `{ "placa": "xyz 987" }` → **200**, placa `XYZ987`.
8. **GET `/ambulancias?estadoOperativo=disponible&busqueda=AMB`** → aparece AMB-01.
9. **GET `/ambulancias/{id}/historial-estados`** → un registro `fuera_servicio → disponible` con tu motivo.
10. Crea un usuario con rol `conductor`, inicia sesión con él y llama **GET `/ambulancias`** → **403**.

---

## Paso 10 — Pruebas unitarias

Las pruebas de entidades y casos de uso usan **dobles en memoria**, igual que las de usuarios en `test/dobles/repositorios_memoria.ts`. No tocan la base de datos.

### 10.1 Dobles en memoria

📄 `test/dobles/ambulancias_memoria.ts`

```typescript
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../src/common/types/resultado_paginado.js';
import { Ambulancia } from '../../src/modules/ambulances/domain/entities/ambulancia.entity.js';
import type { CambioEstadoAmbulancia } from '../../src/modules/ambulances/domain/entities/cambio_estado_ambulancia.entity.js';
import type { TipoAmbulancia } from '../../src/modules/ambulances/domain/entities/tipo_ambulancia.entity.js';
import { AmbulanciasRepositorio } from '../../src/modules/ambulances/domain/repositories/ambulancias.repository.js';
import { TiposAmbulanciaRepositorio } from '../../src/modules/ambulances/domain/repositories/tipos_ambulancia.repository.js';

export const TIPOS_PRUEBA: TipoAmbulancia[] = [
  { id: 't1', nombre: 'TAB', descripcion: null },
  { id: 't2', nombre: 'TAM', descripcion: null },
];

export class TiposAmbulanciaMemoria extends TiposAmbulanciaRepositorio {
  listar(): Promise<TipoAmbulancia[]> {
    return Promise.resolve([...TIPOS_PRUEBA]);
  }

  buscarPorId(id: string): Promise<TipoAmbulancia | null> {
    return Promise.resolve(TIPOS_PRUEBA.find((tipo) => tipo.id === id) ?? null);
  }
}

export class AmbulanciasMemoria extends AmbulanciasRepositorio {
  readonly ambulancias = new Map<string, Ambulancia>();
  readonly historial: CambioEstadoAmbulancia[] = [];

  buscarPorId(id: string): Promise<Ambulancia | null> {
    return Promise.resolve(this.ambulancias.get(id) ?? null);
  }

  existeCodigo(codigo: string, excluirId?: string): Promise<boolean> {
    return Promise.resolve(
      [...this.ambulancias.values()].some(
        (a) => a.codigo === codigo && a.id !== excluirId,
      ),
    );
  }

  existePlaca(placa: string, excluirId?: string): Promise<boolean> {
    return Promise.resolve(
      [...this.ambulancias.values()].some(
        (a) => a.placa === placa && a.id !== excluirId,
      ),
    );
  }

  listar(
    _filtros: unknown,
    { pagina, limite }: Paginacion,
  ): Promise<ResultadoPaginado<Ambulancia>> {
    const datos = [...this.ambulancias.values()];
    return Promise.resolve({ datos, total: datos.length, pagina, limite });
  }

  crear(ambulancia: Ambulancia): Promise<Ambulancia> {
    this.ambulancias.set(ambulancia.id, ambulancia);
    return Promise.resolve(ambulancia);
  }

  actualizar(ambulancia: Ambulancia): Promise<Ambulancia> {
    this.ambulancias.set(ambulancia.id, ambulancia);
    return Promise.resolve(ambulancia);
  }

  cambiarEstado(
    ambulancia: Ambulancia,
    cambio: CambioEstadoAmbulancia,
  ): Promise<Ambulancia> {
    this.ambulancias.set(ambulancia.id, ambulancia);
    this.historial.push(cambio);
    return Promise.resolve(ambulancia);
  }

  listarHistorialEstados(
    ambulanciaId: string,
    { pagina, limite }: Paginacion,
  ): Promise<ResultadoPaginado<CambioEstadoAmbulancia>> {
    const datos = this.historial.filter((c) => c.ambulanciaId === ambulanciaId);
    return Promise.resolve({ datos, total: datos.length, pagina, limite });
  }
}

export function crearAmbulanciaPrueba(
  cambios: Partial<{ codigo: string; placa: string }> = {},
): Ambulancia {
  return Ambulancia.crear({
    codigo: cambios.codigo ?? 'amb-01',
    placa: cambios.placa ?? 'abc-123',
    tipo: TIPOS_PRUEBA[0]!,
  });
}
```

### 10.2 Pruebas

📄 `src/modules/ambulances/domain/entities/ambulancia.entity.spec.ts`

```typescript
import { ReglaNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import { Ambulancia } from './ambulancia.entity.js';

describe('Ambulancia', () => {
  const tipo = { id: 't1', nombre: 'TAB', descripcion: null };

  it('normaliza código y placa y nace fuera de servicio', () => {
    const ambulancia = Ambulancia.crear({
      codigo: ' amb-01 ',
      placa: 'abc 123',
      tipo,
    });

    expect(ambulancia.codigo).toBe('AMB-01');
    expect(ambulancia.placa).toBe('ABC123');
    expect(ambulancia.estadoOperativo).toBe('fuera_servicio');
    expect(ambulancia.estaDisponible()).toBe(false);
  });

  it('permite las transiciones manuales válidas', () => {
    const ambulancia = Ambulancia.crear({
      codigo: 'A1',
      placa: 'ABC123',
      tipo,
    });

    ambulancia.cambiarEstadoManual('disponible');
    expect(ambulancia.estaDisponible()).toBe(true);

    ambulancia.cambiarEstadoManual('mantenimiento');
    expect(ambulancia.estadoOperativo).toBe('mantenimiento');
  });

  it('rechaza cambiar al mismo estado', () => {
    const ambulancia = Ambulancia.crear({
      codigo: 'A1',
      placa: 'ABC123',
      tipo,
    });

    expect(() => ambulancia.cambiarEstadoManual('fuera_servicio')).toThrow(
      ReglaNegocioError,
    );
  });

  it('no deja cambiar a mano ni editar una ambulancia en servicio', () => {
    const ambulancia = Ambulancia.reconstruir({
      id: 'a1',
      codigo: 'A1',
      placa: 'ABC123',
      tipo,
      estadoOperativo: 'en_servicio',
      ultimaUbicacion: null,
      creadaEn: new Date(),
    });

    expect(() => ambulancia.cambiarEstadoManual('disponible')).toThrow(
      ReglaNegocioError,
    );
    expect(() => ambulancia.actualizarDatos({ placa: 'XYZ987' })).toThrow(
      ReglaNegocioError,
    );
  });
});
```

📄 `src/modules/ambulances/application/use-cases/crear_ambulancia.use-case.spec.ts`

```typescript
import {
  AmbulanciasMemoria,
  TiposAmbulanciaMemoria,
  crearAmbulanciaPrueba,
} from '../../../../../test/dobles/ambulancias_memoria.js';
import { AuditoriaMemoria } from '../../../../../test/dobles/repositorios_memoria.js';
import {
  ConflictoNegocioError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import { CrearAmbulancia } from './crear_ambulancia.use-case.js';

describe('CrearAmbulancia', () => {
  const contexto = { usuarioId: 'admin-1', direccionIp: null };
  let ambulancias: AmbulanciasMemoria;
  let auditoria: AuditoriaMemoria;
  let crearAmbulancia: CrearAmbulancia;

  beforeEach(() => {
    ambulancias = new AmbulanciasMemoria();
    auditoria = new AuditoriaMemoria();
    crearAmbulancia = new CrearAmbulancia(
      ambulancias,
      new TiposAmbulanciaMemoria(),
      auditoria,
    );
  });

  it('crea la ambulancia y la audita', async () => {
    const ambulancia = await crearAmbulancia.ejecutar(
      { codigo: 'amb-02', placa: 'xyz-987', tipoAmbulanciaId: 't2' },
      contexto,
    );

    expect(ambulancia.placa).toBe('XYZ987');
    expect(ambulancia.tipo.nombre).toBe('TAM');
    expect(auditoria.eventos[0]?.accion).toBe('crear');
  });

  it('rechaza una placa repetida aunque se escriba distinto', async () => {
    await ambulancias.crear(crearAmbulanciaPrueba({ placa: 'ABC123' }));

    await expect(
      crearAmbulancia.ejecutar(
        { codigo: 'amb-02', placa: 'abc 123', tipoAmbulanciaId: 't1' },
        contexto,
      ),
    ).rejects.toThrow(ConflictoNegocioError);
  });

  it('rechaza un tipo inexistente', async () => {
    await expect(
      crearAmbulancia.ejecutar(
        { codigo: 'amb-02', placa: 'xyz987', tipoAmbulanciaId: 'no-existe' },
        contexto,
      ),
    ).rejects.toThrow(ReglaNegocioError);
  });
});
```

📄 `src/modules/ambulances/application/use-cases/cambiar_estado_ambulancia.use-case.spec.ts`

```typescript
import {
  AmbulanciasMemoria,
  crearAmbulanciaPrueba,
} from '../../../../../test/dobles/ambulancias_memoria.js';
import { AuditoriaMemoria } from '../../../../../test/dobles/repositorios_memoria.js';
import {
  RecursoNoEncontradoError,
  ReglaNegocioError,
} from '../../../../common/exceptions/errores_dominio.js';
import { CambiarEstadoAmbulancia } from './cambiar_estado_ambulancia.use-case.js';

describe('CambiarEstadoAmbulancia', () => {
  const contexto = { usuarioId: 'despachador-1', direccionIp: null };
  let ambulancias: AmbulanciasMemoria;
  let cambiarEstado: CambiarEstadoAmbulancia;

  beforeEach(() => {
    ambulancias = new AmbulanciasMemoria();
    cambiarEstado = new CambiarEstadoAmbulancia(
      ambulancias,
      new AuditoriaMemoria(),
    );
  });

  it('cambia el estado y deja el historial', async () => {
    const ambulancia = await ambulancias.crear(crearAmbulanciaPrueba());

    const resultado = await cambiarEstado.ejecutar(
      {
        ambulanciaId: ambulancia.id,
        estado: 'disponible',
        motivo: 'Inicio de turno',
      },
      contexto,
    );

    expect(resultado.estadoOperativo).toBe('disponible');
    expect(ambulancias.historial).toEqual([
      expect.objectContaining({
        estadoAnterior: 'fuera_servicio',
        estadoNuevo: 'disponible',
        usuarioId: 'despachador-1',
      }),
    ]);
  });

  it('no registra historial si la transición no es válida', async () => {
    const ambulancia = await ambulancias.crear(crearAmbulanciaPrueba());

    await expect(
      cambiarEstado.ejecutar(
        {
          ambulanciaId: ambulancia.id,
          estado: 'fuera_servicio',
          motivo: 'Prueba',
        },
        contexto,
      ),
    ).rejects.toThrow(ReglaNegocioError);
    expect(ambulancias.historial).toHaveLength(0);
  });

  it('falla si la ambulancia no existe', async () => {
    await expect(
      cambiarEstado.ejecutar(
        { ambulanciaId: 'no-existe', estado: 'disponible', motivo: 'Prueba' },
        contexto,
      ),
    ).rejects.toThrow(RecursoNoEncontradoError);
  });
});
```

✅ **Verifica:**

```bash
npm test          # deben pasar todas (las 22 que ya había + 10 nuevas = 32)
```

---

## Paso 11 — Lista de chequeo final

- [ ] `npm run typecheck` sin errores
- [ ] `npm run lint` sin errores
- [ ] `npm test` en verde
- [ ] `npm run format` ejecutado (Prettier)
- [ ] Probado el flujo del Paso 9 en Swagger
- [ ] README: agrega `ambulances/` en la sección **Estructura**:
  ```text
      ├── ambulances/      # flota, tipos de ambulancia y estados operativos
  ```

---

## Lo que viene después (no es parte de este paso)

- **Turnos y tripulación** (`turnos`, `turnos_integrantes`): qué conductor y paramédico van en cada ambulancia. Una buena regla es que una ambulancia solo pueda pasar a `disponible` si tiene un turno activo.
- **Ubicación GPS** (`ubicaciones_ambulancias` y las columnas `ultima_*`): un endpoint o WebSocket para que el celular de la tripulación reporte su posición. Vale validar que el usuario pertenece al turno de esa ambulancia (arquitectura.md §9).
- **Asignaciones**: al despachar, la ambulancia pasa a `en_servicio` y al finalizar vuelve a `disponible`. Para eso tendrás que agregar a la entidad un método distinto de `cambiarEstadoManual`, por ejemplo `iniciarServicio()` / `finalizarServicio()`, que sí permita `en_servicio`.
