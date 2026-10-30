import type { PuntoGeografico } from '../../src/common/utils/geografia.js';
import {
  type MotivoRuta,
  RutaAsignacion,
} from '../../src/modules/routing/domain/entities/ruta_asignacion.entity.js';
import { RutasAsignacionRepositorio } from '../../src/modules/routing/domain/repositories/rutas_asignacion.repository.js';
import {
  ProveedorRutas,
  ProveedoresRutas,
  type RutaCalculada,
} from '../../src/modules/routing/domain/services/proveedor_rutas.js';

export class RutasMemoria extends RutasAsignacionRepositorio {
  readonly rutas: RutaAsignacion[] = [];

  guardar(ruta: RutaAsignacion): Promise<RutaAsignacion> {
    this.rutas.push(ruta);
    return Promise.resolve(ruta);
  }

  buscarVigente(asignacionId: string): Promise<RutaAsignacion | null> {
    return Promise.resolve(
      this.rutas.filter((r) => r.asignacionId === asignacionId).at(-1) ?? null,
    );
  }

  async listarVigentes(
    asignacionIds: readonly string[],
  ): Promise<RutaAsignacion[]> {
    const vigentes = await Promise.all(
      asignacionIds.map((id) => this.buscarVigente(id)),
    );
    return vigentes.filter((r): r is RutaAsignacion => r !== null);
  }
}

/** Línea recta de origen a destino (con un punto intermedio) y cuenta las llamadas. */
export class ProveedorRutasFalso extends ProveedorRutas {
  llamadas: { origen: PuntoGeografico; destino: PuntoGeografico }[] = [];
  respuesta: (
    origen: PuntoGeografico,
    destino: PuntoGeografico,
  ) => Promise<RutaCalculada | null> = (origen, destino) =>
    Promise.resolve({
      geometria: [
        origen,
        {
          latitud: (origen.latitud + destino.latitud) / 2,
          longitud: (origen.longitud + destino.longitud) / 2,
        },
        destino,
      ],
      distanciaMetros: 2532,
      duracionSegundos: 229,
    });

  constructor(
    readonly nombre = 'falso',
    private readonly configurado = true,
  ) {
    super();
  }

  estaConfigurado(): boolean {
    return this.configurado;
  }

  calcular(
    origen: PuntoGeografico,
    destino: PuntoGeografico,
  ): Promise<RutaCalculada | null> {
    this.llamadas.push({ origen, destino });
    return this.respuesta(origen, destino);
  }
}

export class ProveedoresRutasFijos extends ProveedoresRutas {
  constructor(private readonly lista: ProveedorRutas[]) {
    super();
  }

  enOrden(): readonly ProveedorRutas[] {
    return this.lista;
  }
}

export function crearRutaPrueba(
  asignacionId: string,
  cambios: { motivo?: MotivoRuta; calculadaEn?: Date } = {},
): RutaAsignacion {
  const origen = { latitud: 7.8939, longitud: -72.5078 };
  const destino = { latitud: 7.907, longitud: -72.497 };
  return RutaAsignacion.calcular({
    asignacionId,
    tramo: 'hacia_emergencia',
    motivo: cambios.motivo ?? 'despacho',
    origen,
    destino,
    ruta: {
      geometria: [origen, destino],
      distanciaMetros: 2532,
      duracionSegundos: 229,
    },
    proveedor: 'falso',
    calculadaEn: cambios.calculadaEn ?? new Date(),
  });
}
