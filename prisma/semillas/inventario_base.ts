/**
 * Catálogo de insumos y perfiles de dotación TAB/TAM. Idempotente: no modifica
 * lo que ya exista (por código) ni le quita el lugar a un perfil que el
 * administrador ya haya activado.
 */
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { INSUMOS_BASE, PERFILES_BASE } from './catalogo_inventario.js';

async function sembrarInsumos(prisma: PrismaClient): Promise<number> {
  const existentes = new Set(
    (await prisma.insumo.findMany({ select: { codigo: true } })).map(
      (i) => i.codigo,
    ),
  );
  const nuevos = INSUMOS_BASE.filter((i) => !existentes.has(i.codigo));
  if (nuevos.length > 0) {
    await prisma.insumo.createMany({
      data: nuevos.map((i) => ({
        id: crypto.randomUUID(),
        codigo: i.codigo,
        nombre: i.nombre,
        tipo: i.tipo,
        categoria: i.categoria,
        unidadMedida: i.unidadMedida,
        requiereSerie: i.control === 'serie',
        requiereLote: i.control === 'lote',
        requiereVencimiento: i.control === 'lote',
        requiereRegistroSanitario: i.requiereRegistroSanitario,
        esControlEspecial: i.esControlEspecial ?? false,
        stockMinimo: i.stockMinimo,
      })),
    });
  }
  return nuevos.length;
}

async function sembrarPerfiles(prisma: PrismaClient): Promise<string[]> {
  const insumoPorCodigo = new Map(
    (await prisma.insumo.findMany({ select: { id: true, codigo: true } })).map(
      (i) => [i.codigo, i.id],
    ),
  );
  const creados: string[] = [];

  for (const perfil of PERFILES_BASE) {
    const tipo = await prisma.tipoAmbulancia.findUnique({
      where: { nombre: perfil.tipoAmbulancia },
      select: { id: true },
    });
    if (!tipo) {
      console.warn(
        `No existe el tipo de ambulancia ${perfil.tipoAmbulancia}; se omite ${perfil.codigo}.`,
      );
      continue;
    }
    const yaExiste = await prisma.perfilDotacion.count({
      where: { tipoAmbulanciaId: tipo.id, codigo: perfil.codigo },
    });
    if (yaExiste > 0) continue;

    const hayActivo =
      (await prisma.perfilDotacion.count({
        where: { tipoAmbulanciaId: tipo.id, activo: true },
      })) > 0;
    await prisma.perfilDotacion.create({
      data: {
        id: crypto.randomUUID(),
        tipoAmbulanciaId: tipo.id,
        codigo: perfil.codigo,
        nombre: perfil.nombre,
        descripcion: perfil.descripcion,
        version: 1,
        activo: !hayActivo,
        detalles: {
          create: perfil.elementos.flatMap(([codigo, requerida, minima]) => {
            const insumoId = insumoPorCodigo.get(codigo);
            return insumoId
              ? [
                  {
                    id: crypto.randomUUID(),
                    insumoId,
                    cantidadRequerida: requerida,
                    cantidadMinima: minima,
                    obligatorio: true,
                  },
                ]
              : [];
          }),
        },
      },
    });
    creados.push(
      `${perfil.codigo} (${perfil.elementos.length} elementos, ${hayActivo ? 'inactivo: ya había uno activo' : 'activo'})`,
    );
  }
  return creados;
}

export async function sembrarInventarioBase(
  prisma: PrismaClient,
): Promise<void> {
  const insumos = await sembrarInsumos(prisma);
  const perfiles = await sembrarPerfiles(prisma);
  console.info(
    `Inventario base: ${insumos} insumos nuevos (de ${INSUMOS_BASE.length}); perfiles nuevos: ${perfiles.length ? perfiles.join(', ') : 'ninguno'}.`,
  );
}
