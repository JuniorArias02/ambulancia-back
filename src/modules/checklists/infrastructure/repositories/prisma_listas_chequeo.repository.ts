import { Injectable } from '@nestjs/common';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import { PrismaService } from '../../../../database/prisma.service.js';
import type { Prisma } from '../../../../generated/prisma/client.js';
import { ListaChequeo } from '../../domain/entities/lista_chequeo.entity.js';
import {
  type FiltrosListasChequeo,
  ListasChequeoRepositorio,
} from '../../domain/repositories/listas_chequeo.repository.js';

const seleccionLista = {
  id: true,
  nombre: true,
  descripcion: true,
  activa: true,
  creadaPorId: true,
  creadaEn: true,
  actualizadaEn: true,
  items: {
    select: {
      id: true,
      pregunta: true,
      orden: true,
      obligatorio: true,
      permiteObservacion: true,
      activo: true,
    },
    orderBy: { orden: 'asc' },
  },
  estados: {
    select: { id: true, nombre: true, valor: true, orden: true, activo: true },
    orderBy: { orden: 'asc' },
  },
} satisfies Prisma.ListaChequeoSelect;

type RegistroLista = Prisma.ListaChequeoGetPayload<{
  select: typeof seleccionLista;
}>;
type Transaccion = Prisma.TransactionClient;

@Injectable()
export class PrismaListasChequeoRepositorio extends ListasChequeoRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async buscarPorId(id: string): Promise<ListaChequeo | null> {
    const registro = await this.prisma.listaChequeo.findUnique({
      where: { id },
      select: seleccionLista,
    });
    return registro ? this.aEntidad(registro) : null;
  }

  async buscarActiva(): Promise<ListaChequeo | null> {
    const registro = await this.prisma.listaChequeo.findFirst({
      where: { activa: true },
      select: seleccionLista,
    });
    return registro ? this.aEntidad(registro) : null;
  }

  async listar(
    { activa, busqueda }: FiltrosListasChequeo,
    { pagina, limite }: Paginacion,
  ): Promise<ResultadoPaginado<ListaChequeo>> {
    const where: Prisma.ListaChequeoWhereInput = {
      activa,
      nombre: busqueda ? { contains: busqueda } : undefined,
    };
    const [total, registros] = await this.prisma.$transaction([
      this.prisma.listaChequeo.count({ where }),
      this.prisma.listaChequeo.findMany({
        where,
        select: seleccionLista,
        orderBy: { creadaEn: 'desc' },
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

  async crear(lista: ListaChequeo): Promise<ListaChequeo> {
    await this.prisma.listaChequeo.create({
      data: {
        id: lista.id,
        nombre: lista.nombre,
        descripcion: lista.descripcion,
        activa: lista.activa,
        creadaPorId: lista.creadaPorId,
        creadaEn: lista.creadaEn,
        items: { create: lista.items.map((item) => ({ ...item })) },
        estados: { create: lista.estados.map((estado) => ({ ...estado })) },
      },
    });
    return this.recargar(lista.id);
  }

  async actualizar(lista: ListaChequeo): Promise<ListaChequeo> {
    await this.prisma.$transaction((tx) => this.guardar(tx, lista));
    return this.recargar(lista.id);
  }

  async activarUnica(lista: ListaChequeo): Promise<ListaChequeo> {
    await this.prisma.$transaction(async (tx) => {
      // Primero se apagan las demás: nunca quedan dos activas.
      await tx.listaChequeo.updateMany({
        where: { id: { not: lista.id }, activa: true },
        data: { activa: false, actualizadaEn: lista.actualizadaEn },
      });
      await this.guardar(tx, lista);
    });
    return this.recargar(lista.id);
  }

  async itemTieneRespuestas(itemId: string): Promise<boolean> {
    const total = await this.prisma.respuestaChequeo.count({
      where: { itemId },
    });
    return total > 0;
  }

  /** Datos de la lista y upsert de cada pregunta y opción (crea las nuevas). */
  private async guardar(tx: Transaccion, lista: ListaChequeo): Promise<void> {
    await tx.listaChequeo.update({
      where: { id: lista.id },
      data: {
        nombre: lista.nombre,
        descripcion: lista.descripcion,
        activa: lista.activa,
        actualizadaEn: lista.actualizadaEn,
      },
    });
    for (const { id, ...item } of lista.items) {
      await tx.itemListaChequeo.upsert({
        where: { id },
        create: { id, ...item, listaChequeoId: lista.id },
        update: item,
      });
    }
    for (const { id, ...estado } of lista.estados) {
      await tx.estadoListaChequeo.upsert({
        where: { id },
        create: { id, ...estado, listaChequeoId: lista.id },
        update: estado,
      });
    }
  }

  private async recargar(id: string): Promise<ListaChequeo> {
    const registro = await this.prisma.listaChequeo.findUniqueOrThrow({
      where: { id },
      select: seleccionLista,
    });
    return this.aEntidad(registro);
  }

  private aEntidad(registro: RegistroLista): ListaChequeo {
    return ListaChequeo.reconstruir({
      ...registro,
      items: registro.items.map((item) => ({ ...item })),
      estados: registro.estados.map((estado) => ({ ...estado })),
    });
  }
}
