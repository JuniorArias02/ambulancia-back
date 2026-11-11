import { Injectable } from '@nestjs/common';
import { ConflictoNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import { PrismaService } from '../../../../database/prisma.service.js';
import { Prisma } from '../../../../generated/prisma/client.js';
import {
  ChequeoDiario,
  ESTADOS_CHEQUEO,
} from '../../domain/entities/chequeo_diario.entity.js';
import {
  ChequeosDiariosRepositorio,
  type ClaveChequeoDelDia,
  type FiltrosChequeosDiarios,
} from '../../domain/repositories/chequeos_diarios.repository.js';

const seleccionChequeo = {
  id: true,
  listaChequeoId: true,
  conductorId: true,
  ambulanciaId: true,
  fecha: true,
  iniciadoEn: true,
  finalizadoEn: true,
  estado: true,
  conductor: { select: { nombres: true, apellidos: true } },
  ambulancia: { select: { codigo: true } },
  respuestas: {
    select: {
      id: true,
      itemId: true,
      estadoId: true,
      tieneObservacion: true,
      observacion: true,
      respondidoEn: true,
    },
  },
} satisfies Prisma.ChequeoDiarioSelect;

type RegistroChequeo = Prisma.ChequeoDiarioGetPayload<{
  select: typeof seleccionChequeo;
}>;

/** DATE sin hora: el proyecto guarda la medianoche UTC del día de calendario. */
function aFechaBd(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}

@Injectable()
export class PrismaChequeosDiariosRepositorio extends ChequeosDiariosRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async buscarPorId(id: string): Promise<ChequeoDiario | null> {
    const registro = await this.prisma.chequeoDiario.findUnique({
      where: { id },
      select: seleccionChequeo,
    });
    return registro ? this.aEntidad(registro) : null;
  }

  async buscarDelDia(clave: ClaveChequeoDelDia): Promise<ChequeoDiario | null> {
    const registro = await this.prisma.chequeoDiario.findUnique({
      where: {
        listaChequeoId_conductorId_ambulanciaId_fecha: {
          listaChequeoId: clave.listaChequeoId,
          conductorId: clave.conductorId,
          ambulanciaId: clave.ambulanciaId,
          fecha: aFechaBd(clave.fecha),
        },
      },
      select: seleccionChequeo,
    });
    return registro ? this.aEntidad(registro) : null;
  }

  async crear(
    chequeo: ChequeoDiario,
  ): Promise<{ chequeo: ChequeoDiario; creado: boolean }> {
    try {
      const registro = await this.prisma.chequeoDiario.create({
        data: {
          id: chequeo.id,
          listaChequeoId: chequeo.listaChequeoId,
          conductorId: chequeo.conductorId,
          ambulanciaId: chequeo.ambulanciaId,
          fecha: aFechaBd(chequeo.fecha),
          iniciadoEn: chequeo.iniciadoEn,
          estado: chequeo.estado,
        },
        select: seleccionChequeo,
      });
      return { chequeo: this.aEntidad(registro), creado: true };
    } catch (error) {
      // Dos toques seguidos de "Iniciar": `uk_chequeo_diario` deja pasar uno.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existente = await this.buscarDelDia({
          listaChequeoId: chequeo.listaChequeoId,
          conductorId: chequeo.conductorId,
          ambulanciaId: chequeo.ambulanciaId,
          fecha: chequeo.fecha,
        });
        if (existente) return { chequeo: existente, creado: false };
      }
      throw error;
    }
  }

  async guardarRespuestas(chequeo: ChequeoDiario): Promise<ChequeoDiario> {
    await this.prisma.$transaction(async (tx) => {
      // Bloquea la fila: una finalización simultánea espera a que termine esto.
      const filas = await tx.$queryRaw<{ estado: string }[]>`
        SELECT estado FROM chequeos_diarios WHERE id = ${chequeo.id} FOR UPDATE`;
      if (filas[0]?.estado !== 'borrador') {
        throw new ConflictoNegocioError(
          'El chequeo ya fue finalizado; vuelva a consultarlo',
        );
      }
      for (const { id, itemId, ...respuesta } of chequeo.respuestas) {
        await tx.respuestaChequeo.upsert({
          where: { chequeoId_itemId: { chequeoId: chequeo.id, itemId } },
          create: { id, itemId, chequeoId: chequeo.id, ...respuesta },
          update: respuesta,
        });
      }
    });
    return this.recargar(chequeo.id);
  }

  async finalizar(chequeo: ChequeoDiario): Promise<ChequeoDiario> {
    const { count } = await this.prisma.chequeoDiario.updateMany({
      where: { id: chequeo.id, estado: 'borrador' },
      data: { estado: chequeo.estado, finalizadoEn: chequeo.finalizadoEn },
    });
    if (count === 0) {
      throw new ConflictoNegocioError(
        'El chequeo ya fue finalizado; vuelva a consultarlo',
      );
    }
    return this.recargar(chequeo.id);
  }

  async listar(
    filtros: FiltrosChequeosDiarios,
    { pagina, limite }: Paginacion,
  ): Promise<ResultadoPaginado<ChequeoDiario>> {
    const where: Prisma.ChequeoDiarioWhereInput = {
      conductorId: filtros.conductorId,
      ambulanciaId: filtros.ambulanciaId,
      estado: filtros.estado,
      fecha:
        filtros.desde || filtros.hasta
          ? {
              gte: filtros.desde ? aFechaBd(filtros.desde) : undefined,
              lte: filtros.hasta ? aFechaBd(filtros.hasta) : undefined,
            }
          : undefined,
    };
    const [total, registros] = await this.prisma.$transaction([
      this.prisma.chequeoDiario.count({ where }),
      this.prisma.chequeoDiario.findMany({
        where,
        select: seleccionChequeo,
        orderBy: [{ fecha: 'desc' }, { iniciadoEn: 'desc' }],
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

  private async recargar(id: string): Promise<ChequeoDiario> {
    const registro = await this.prisma.chequeoDiario.findUniqueOrThrow({
      where: { id },
      select: seleccionChequeo,
    });
    return this.aEntidad(registro);
  }

  private aEntidad(registro: RegistroChequeo): ChequeoDiario {
    const estado = ESTADOS_CHEQUEO.find((e) => e === registro.estado);
    if (!estado) {
      throw new Error(
        `Estado de chequeo desconocido en la base de datos: ${registro.estado}`,
      );
    }
    return ChequeoDiario.reconstruir({
      id: registro.id,
      listaChequeoId: registro.listaChequeoId,
      conductorId: registro.conductorId,
      ambulanciaId: registro.ambulanciaId,
      fecha: registro.fecha.toISOString().slice(0, 10),
      iniciadoEn: registro.iniciadoEn,
      finalizadoEn: registro.finalizadoEn,
      estado,
      respuestas: registro.respuestas.map((r) => ({ ...r })),
      conductorNombre: `${registro.conductor.nombres} ${registro.conductor.apellidos}`,
      ambulanciaCodigo: registro.ambulancia.codigo,
    });
  }
}
