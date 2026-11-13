/**
 * Datos de DEMOSTRACIÓN del inventario, para desarrollo y pruebas. Nunca en producción.
 *
 * Crea la "Bodega central", registros sanitarios y lotes ficticios (todo con el
 * prefijo DEMO, para que no se confundan con datos reales de INVIMA), equipos
 * por serie, una entrada a la bodega y una transferencia que abastece cada
 * ambulancia según el perfil de dotación activo de su tipo. Deja a propósito
 * un lote por vencer, uno vencido, un equipo con mantenimiento próximo y un
 * insumo bajo el stock mínimo, para que las alertas tengan contenido.
 *
 * Requiere el catálogo base: ejecute antes `npm run db:semilla`.
 * Uso: `npm run db:semilla:inventario-demo`. Si ya se ejecutó, no hace nada.
 */
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import {
  diaColombia,
  fechaColombia,
} from '../src/common/utils/fecha_colombia.js';
import { type Prisma, PrismaClient } from '../src/generated/prisma/client.js';
import { INSUMOS_BASE } from './semillas/catalogo_inventario.js';

const REFERENCIA = 'SEMILLA-DEMO-INVENTARIO';
const CODIGO_BODEGA = 'BOD-CENTRAL';
/** Lo que queda en bodega de un insumo después de abastecer; por defecto, su stock mínimo. */
const RESERVA_ESPECIAL: Record<string, number> = { 'INS-014': 10 };

function variableRequerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}`);
  return valor;
}

if (process.env['NODE_ENV'] === 'production') {
  throw new Error(
    'La semilla de demostración del inventario no se ejecuta en producción.',
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(variableRequerida('DATABASE_URL')),
});

const hoy = fechaColombia(new Date());

/** "AAAA-MM-DD" desplazada `dias` días. */
function dia(dias: number): string {
  const fecha = new Date(`${hoy}T00:00:00.000Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

const fechaBd = (fecha: string) => new Date(`${fecha}T00:00:00.000Z`);

type Tx = Prisma.TransactionClient;

interface InsumoBd {
  id: string;
  codigo: string;
  nombre: string;
  requiereLote: boolean;
  requiereSerie: boolean;
  requiereRegistroSanitario: boolean;
  stockMinimo: Prisma.Decimal;
}

interface Linea {
  insumoId: string;
  loteId: string | null;
  equipoId: string | null;
  cantidad: number;
}

/** Existencias calculadas en memoria y escritas al final: (ubicación, clave) → cantidad. */
class Existencias {
  private readonly filas = new Map<
    string,
    Linea & { ubicacionId: string; clave: string }
  >();

  mover(origen: string | null, destino: string | null, linea: Linea): void {
    if (origen) this.sumar(origen, linea, -linea.cantidad);
    if (destino) this.sumar(destino, linea, linea.cantidad);
  }

  private sumar(ubicacionId: string, linea: Linea, cantidad: number): void {
    const clave = linea.equipoId
      ? `equipo:${linea.equipoId}`
      : linea.loteId
        ? `lote:${linea.loteId}`
        : `insumo:${linea.insumoId}`;
    const llave = `${ubicacionId}|${clave}`;
    const fila = this.filas.get(llave) ?? {
      ...linea,
      cantidad: 0,
      ubicacionId,
      clave,
    };
    fila.cantidad += cantidad;
    if (fila.cantidad < 0) throw new Error(`Existencia negativa en ${llave}`);
    this.filas.set(llave, fila);
  }

  async guardar(tx: Tx): Promise<number> {
    for (const fila of this.filas.values()) {
      await tx.existencia.upsert({
        where: {
          ubicacionId_claveControl: {
            ubicacionId: fila.ubicacionId,
            claveControl: fila.clave,
          },
        },
        create: {
          id: crypto.randomUUID(),
          ubicacionId: fila.ubicacionId,
          insumoId: fila.insumoId,
          loteId: fila.loteId,
          equipoId: fila.equipoId,
          claveControl: fila.clave,
          cantidad: fila.cantidad,
        },
        update: { cantidad: { increment: fila.cantidad } },
      });
    }
    return this.filas.size;
  }
}

async function registrarMovimiento(
  tx: Tx,
  datos: {
    codigo: string;
    tipo: 'entrada' | 'transferencia';
    origenUbicacionId: string | null;
    destinoUbicacionId: string;
    usuarioId: string;
    observaciones: string;
    realizadoEn: Date;
    lineas: Linea[];
  },
  existencias: Existencias,
): Promise<void> {
  await tx.movimientoInventario.create({
    data: {
      id: crypto.randomUUID(),
      codigo: datos.codigo,
      tipo: datos.tipo,
      estado: 'confirmado',
      origenUbicacionId: datos.origenUbicacionId,
      destinoUbicacionId: datos.destinoUbicacionId,
      usuarioId: datos.usuarioId,
      documentoReferencia: REFERENCIA,
      observaciones: datos.observaciones,
      realizadoEn: datos.realizadoEn,
      detalles: {
        create: datos.lineas.map((l) => ({ id: crypto.randomUUID(), ...l })),
      },
    },
  });
  for (const linea of datos.lineas) {
    existencias.mover(datos.origenUbicacionId, datos.destinoUbicacionId, linea);
  }
}

async function sembrar(): Promise<void> {
  if (
    (await prisma.movimientoInventario.count({
      where: { documentoReferencia: REFERENCIA },
    })) > 0
  ) {
    console.info(
      'La semilla de demostración del inventario ya se ejecutó; no se modifica nada.',
    );
    return;
  }
  if ((await prisma.bodega.count({ where: { codigo: CODIGO_BODEGA } })) > 0) {
    throw new Error(
      `Ya existe la bodega ${CODIGO_BODEGA} creada a mano: la semilla de demostración no la toca.`,
    );
  }

  const administrador = await prisma.usuario.findUniqueOrThrow({
    where: {
      correo: variableRequerida('SEMILLA_ADMIN_CORREO').trim().toLowerCase(),
    },
    select: { id: true },
  });
  const codigos = INSUMOS_BASE.map((i) => i.codigo);
  const insumos: InsumoBd[] = await prisma.insumo.findMany({
    where: { codigo: { in: codigos } },
    select: {
      id: true,
      codigo: true,
      nombre: true,
      requiereLote: true,
      requiereSerie: true,
      requiereRegistroSanitario: true,
      stockMinimo: true,
    },
  });
  if (insumos.length !== codigos.length) {
    throw new Error(
      'Falta el catálogo base del inventario: ejecute primero `npm run db:semilla`.',
    );
  }
  const ambulancias = await prisma.ambulancia.findMany({
    select: { id: true, codigo: true, tipoAmbulanciaId: true },
    orderBy: { codigo: 'asc' },
  });
  const perfiles = await prisma.perfilDotacion.findMany({
    where: { activo: true },
    select: {
      tipoAmbulanciaId: true,
      codigo: true,
      detalles: { select: { insumoId: true, cantidadRequerida: true } },
    },
  });
  const perfilDeTipo = new Map(perfiles.map((p) => [p.tipoAmbulanciaId, p]));

  // Lo que necesita cada ambulancia y el total por insumo.
  const necesidades = ambulancias.map((a) => ({
    ambulancia: a,
    elementos: (perfilDeTipo.get(a.tipoAmbulanciaId)?.detalles ?? []).map(
      (d) => ({
        insumoId: d.insumoId,
        cantidad: d.cantidadRequerida.toNumber(),
      }),
    ),
  }));
  const totalPorInsumo = new Map<string, number>();
  for (const { elementos } of necesidades) {
    for (const e of elementos) {
      totalPorInsumo.set(
        e.insumoId,
        (totalPorInsumo.get(e.insumoId) ?? 0) + e.cantidad,
      );
    }
  }

  const resumen = await prisma.$transaction(
    async (tx) => {
      const existencias = new Existencias();

      // 1. Bodega y ubicaciones
      const bodegaId = crypto.randomUUID();
      const ubicacionBodega = crypto.randomUUID();
      await tx.bodega.create({
        data: {
          id: bodegaId,
          codigo: CODIGO_BODEGA,
          nombre: 'Bodega central',
          ubicacion: 'Sede principal (datos de demostración)',
          responsableId: administrador.id,
          ubicacionInventario: {
            create: { id: ubicacionBodega, tipo: 'bodega' },
          },
        },
      });
      const ubicacionDeAmbulancia = new Map<string, string>();
      for (const { id } of ambulancias) {
        const ubicacion = await tx.ubicacionInventario.upsert({
          where: { ambulanciaId: id },
          create: {
            id: crypto.randomUUID(),
            tipo: 'ambulancia',
            ambulanciaId: id,
          },
          update: {},
          select: { id: true },
        });
        ubicacionDeAmbulancia.set(id, ubicacion.id);
      }

      // 2. Registros sanitarios de demostración
      const registroDe = new Map<string, string>();
      for (const insumo of insumos.filter(
        (i) =>
          i.requiereRegistroSanitario && (i.requiereLote || i.requiereSerie),
      )) {
        const id = crypto.randomUUID();
        await tx.registroSanitario.create({
          data: {
            id,
            insumoId: insumo.id,
            numeroRegistro: `DEMO-INVIMA-${insumo.codigo}`,
            tipoRegistro: 'registro_sanitario',
            fechaExpedicion: fechaBd(dia(-730)),
            fechaVencimiento: fechaBd(dia(1825)),
            titular: 'Datos de demostración',
            estado: 'vigente',
          },
        });
        registroDe.set(insumo.id, id);
      }

      // 3. Lotes: uno vigente por insumo, más uno por vencer y uno vencido para las alertas
      const loteVigenteDe = new Map<string, string>();
      const crearLote = async (
        insumo: InsumoBd,
        sufijo: string,
        fabricacion: string,
        vencimiento: string,
      ) => {
        const id = crypto.randomUUID();
        await tx.lote.create({
          data: {
            id,
            insumoId: insumo.id,
            registroSanitarioId: registroDe.get(insumo.id) ?? null,
            numeroLote: `DEMO-${insumo.codigo}-${sufijo}`,
            fechaFabricacion: fechaBd(fabricacion),
            fechaVencimiento: fechaBd(vencimiento),
            proveedor: 'Proveedor de demostración',
            recibidoEn: new Date(),
            observaciones: 'Lote ficticio de la semilla de demostración',
          },
        });
        return id;
      };
      for (const insumo of insumos.filter((i) => i.requiereLote)) {
        const vence = insumo.codigo.startsWith('OXI') ? dia(1095) : dia(540);
        loteVigenteDe.set(
          insumo.id,
          await crearLote(insumo, '01', dia(-180), vence),
        );
      }
      const porCodigo = new Map(insumos.map((i) => [i.codigo, i]));
      const adrenalina = porCodigo.get('MED-001');
      const salina = porCodigo.get('SOL-001');
      const lineasExtra: Linea[] = [];
      if (adrenalina) {
        const pronto = await crearLote(
          adrenalina,
          'PRONTO',
          dia(-500),
          dia(20),
        );
        lineasExtra.push({
          insumoId: adrenalina.id,
          loteId: pronto,
          equipoId: null,
          cantidad: 5,
        });
      }
      if (salina) {
        const vencido = await crearLote(salina, 'VENCIDO', dia(-730), dia(-15));
        lineasExtra.push({
          insumoId: salina.id,
          loteId: vencido,
          equipoId: null,
          cantidad: 8,
        });
      }

      // 4. Equipos: uno por ambulancia que lo necesite y uno de repuesto en bodega
      const equiposLibres = new Map<string, string[]>();
      let totalEquipos = 0;
      for (const insumo of insumos.filter((i) => i.requiereSerie)) {
        const unidades = (totalPorInsumo.get(insumo.id) ?? 0) + 1;
        const ids: string[] = [];
        for (let n = 1; n <= unidades; n++) {
          const id = crypto.randomUUID();
          const esRepuestoDea = insumo.codigo === 'EQ-001' && n === unidades;
          await tx.equipo.create({
            data: {
              id,
              insumoId: insumo.id,
              registroSanitarioId: registroDe.get(insumo.id) ?? null,
              numeroSerie: `DEMO-${insumo.codigo}-${String(n).padStart(3, '0')}`,
              marca: 'Demostración',
              fechaAdquisicion: fechaBd(dia(-365)),
              estado: 'operativo',
              fechaUltimoMantenimiento: fechaBd(dia(-90)),
              // El DEA de repuesto queda con mantenimiento próximo, para las alertas.
              fechaProximoMantenimiento: fechaBd(
                esRepuestoDea ? dia(10) : dia(90),
              ),
            },
          });
          ids.push(id);
        }
        equiposLibres.set(insumo.id, ids);
        totalEquipos += ids.length;
      }

      // 5. Entrada a la bodega: lo que van a llevar las ambulancias más la reserva
      const lineasEntrada: Linea[] = [...lineasExtra];
      for (const insumo of insumos) {
        if (insumo.requiereSerie) {
          for (const equipoId of equiposLibres.get(insumo.id) ?? []) {
            lineasEntrada.push({
              insumoId: insumo.id,
              loteId: null,
              equipoId,
              cantidad: 1,
            });
          }
          continue;
        }
        const reserva =
          RESERVA_ESPECIAL[insumo.codigo] ?? insumo.stockMinimo.toNumber();
        const cantidad = (totalPorInsumo.get(insumo.id) ?? 0) + reserva;
        if (cantidad <= 0) continue;
        lineasEntrada.push({
          insumoId: insumo.id,
          loteId: insumo.requiereLote
            ? (loteVigenteDe.get(insumo.id) ?? null)
            : null,
          equipoId: null,
          cantidad,
        });
      }
      const ahora = Date.now();
      await registrarMovimiento(
        tx,
        {
          codigo: `MOV-${diaColombia(new Date())}-DEMO-ENTRADA`,
          tipo: 'entrada',
          origenUbicacionId: null,
          destinoUbicacionId: ubicacionBodega,
          usuarioId: administrador.id,
          observaciones: 'Entrada inicial de demostración',
          realizadoEn: new Date(ahora - 2 * 60 * 60 * 1000),
          lineas: lineasEntrada,
        },
        existencias,
      );

      // 6. Abastecer cada ambulancia según su perfil
      const abastecidas: string[] = [];
      for (const { ambulancia, elementos } of necesidades) {
        if (elementos.length === 0) continue;
        const lineas: Linea[] = elementos.map((e) => {
          const insumo = insumos.find((i) => i.id === e.insumoId);
          if (insumo?.requiereSerie) {
            const equipoId = equiposLibres.get(e.insumoId)?.shift() ?? null;
            return {
              insumoId: e.insumoId,
              loteId: null,
              equipoId,
              cantidad: 1,
            };
          }
          return {
            insumoId: e.insumoId,
            loteId: insumo?.requiereLote
              ? (loteVigenteDe.get(e.insumoId) ?? null)
              : null,
            equipoId: null,
            cantidad: e.cantidad,
          };
        });
        await registrarMovimiento(
          tx,
          {
            codigo: `MOV-${diaColombia(new Date())}-DEMO-${ambulancia.codigo}`,
            tipo: 'transferencia',
            origenUbicacionId: ubicacionBodega,
            destinoUbicacionId: ubicacionDeAmbulancia.get(ambulancia.id) ?? '',
            usuarioId: administrador.id,
            observaciones: `Abastecimiento inicial de ${ambulancia.codigo} (demostración)`,
            realizadoEn: new Date(ahora - 60 * 60 * 1000),
            lineas,
          },
          existencias,
        );
        abastecidas.push(`${ambulancia.codigo} (${lineas.length} elementos)`);
      }

      // 7. Una lectura de temperatura y humedad en la bodega
      await tx.controlAlmacenamiento.create({
        data: {
          id: crypto.randomUUID(),
          ubicacionId: ubicacionBodega,
          usuarioId: administrador.id,
          temperatura: 22.5,
          humedad: 55,
          registradoEn: new Date(),
          observaciones: 'Lectura de demostración',
        },
      });

      const filas = await existencias.guardar(tx);
      return {
        registros: registroDe.size,
        lotes: loteVigenteDe.size + lineasExtra.length,
        equipos: totalEquipos,
        lineasEntrada: lineasEntrada.length,
        abastecidas,
        filas,
      };
    },
    { timeout: 120_000, maxWait: 10_000 },
  );

  const sinPerfil = necesidades
    .filter((n) => n.elementos.length === 0)
    .map((n) => n.ambulancia.codigo);
  console.info(
    [
      'Semilla de demostración del inventario aplicada:',
      `- Bodega ${CODIGO_BODEGA} con su ubicación`,
      `- ${resumen.registros} registros sanitarios DEMO, ${resumen.lotes} lotes DEMO, ${resumen.equipos} equipos`,
      `- Entrada a bodega con ${resumen.lineasEntrada} líneas`,
      `- Ambulancias abastecidas: ${resumen.abastecidas.join(', ') || 'ninguna'}`,
      sinPerfil.length
        ? `- Sin perfil activo para su tipo: ${sinPerfil.join(', ')}`
        : '',
      `- ${resumen.filas} existencias`,
    ]
      .filter(Boolean)
      .join('\n'),
  );
}

try {
  await sembrar();
} finally {
  await prisma.$disconnect();
}
