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

export const seleccionAmbulancia = {
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

export type RegistroAmbulancia = Prisma.AmbulanciaGetPayload<{
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

export function ambulanciaDesdeRegistro(
  registro: RegistroAmbulancia,
): Ambulancia {
  const { ultimaLatitud, ultimaLongitud, ultimaUbicacionEn } = registro;

  return Ambulancia.reconstruir({
    id: registro.id,
    codigo: registro.codigo,
    placa: registro.placa,
    tipo: registro.tipoAmbulancia,
    estadoOperativo: validarEstado(registro.estadoOperativo),
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

function validarEstado(estado: string): EstadoOperativo {
  if (!Ambulancia.esEstadoValido(estado)) {
    throw new Error(
      `Estado de ambulancia desconocido en la base de datos: ${estado}`,
    );
  }
  return estado;
}

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
    return registro ? ambulanciaDesdeRegistro(registro) : null;
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
      datos: registros.map((registro) => ambulanciaDesdeRegistro(registro)),
      total,
      pagina,
      limite,
    };
  }

  async listarTodas(): Promise<Ambulancia[]> {
    const registros = await this.prisma.ambulancia.findMany({
      select: seleccionAmbulancia,
      orderBy: { codigo: 'asc' },
    });
    return registros.map((registro) => ambulanciaDesdeRegistro(registro));
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
      return ambulanciaDesdeRegistro(registro);
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
      return ambulanciaDesdeRegistro(registro);
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
    return ambulanciaDesdeRegistro(registro);
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

  private aCambioEstado(
    registro: RegistroCambioEstado,
  ): CambioEstadoAmbulancia {
    return {
      ...registro,
      estadoAnterior:
        registro.estadoAnterior === null
          ? null
          : validarEstado(registro.estadoAnterior),
      estadoNuevo: validarEstado(registro.estadoNuevo),
    };
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
