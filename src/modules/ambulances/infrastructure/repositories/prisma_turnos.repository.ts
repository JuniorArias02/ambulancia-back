import { Injectable } from '@nestjs/common';
import { ConflictoNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import { PrismaService } from '../../../../database/prisma.service.js';
import type { Prisma } from '../../../../generated/prisma/client.js';
import {
  ESTADOS_TURNO,
  FUNCIONES_TRIPULANTE,
  Turno,
} from '../../domain/entities/turno.entity.js';
import {
  type FiltrosTurnos,
  TurnosRepositorio,
} from '../../domain/repositories/turnos.repository.js';

const seleccionTurno = {
  id: true,
  ambulanciaId: true,
  inicio: true,
  fin: true,
  estado: true,
  ambulancia: { select: { codigo: true } },
  integrantes: {
    select: {
      usuarioId: true,
      funcion: true,
      usuario: { select: { nombres: true, apellidos: true } },
    },
  },
} satisfies Prisma.TurnoSelect;

type RegistroTurno = Prisma.TurnoGetPayload<{ select: typeof seleccionTurno }>;

@Injectable()
export class PrismaTurnosRepositorio extends TurnosRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async buscarPorId(id: string): Promise<Turno | null> {
    const registro = await this.prisma.turno.findUnique({
      where: { id },
      select: seleccionTurno,
    });
    return registro ? this.aEntidad(registro) : null;
  }

  async buscarActivoDeAmbulancia(ambulanciaId: string): Promise<Turno | null> {
    const registro = await this.prisma.turno.findFirst({
      where: { ambulanciaId, estado: 'activo' },
      select: seleccionTurno,
    });
    return registro ? this.aEntidad(registro) : null;
  }

  async buscarActivoDeUsuario(usuarioId: string): Promise<Turno | null> {
    const registro = await this.prisma.turno.findFirst({
      where: { estado: 'activo', integrantes: { some: { usuarioId } } },
      select: seleccionTurno,
    });
    return registro ? this.aEntidad(registro) : null;
  }

  async listar(
    filtros: FiltrosTurnos,
    { pagina, limite }: Paginacion,
  ): Promise<ResultadoPaginado<Turno>> {
    const where: Prisma.TurnoWhereInput = {
      ambulanciaId: filtros.ambulanciaId,
      estado: filtros.estado,
      integrantes: filtros.usuarioId
        ? { some: { usuarioId: filtros.usuarioId } }
        : undefined,
    };
    const [total, registros] = await this.prisma.$transaction([
      this.prisma.turno.count({ where }),
      this.prisma.turno.findMany({
        where,
        select: seleccionTurno,
        orderBy: { inicio: 'desc' },
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

  async crear(turno: Turno): Promise<Turno> {
    const registro = await this.prisma.$transaction(async (tx) => {
      // Bloquea la fila de la ambulancia: dos turnos simultáneos no pasan ambos.
      await tx.$queryRaw`SELECT id FROM ambulancias WHERE id = ${turno.ambulanciaId} FOR UPDATE`;
      const activos = await tx.turno.count({
        where: { ambulanciaId: turno.ambulanciaId, estado: 'activo' },
      });
      if (activos > 0) {
        throw new ConflictoNegocioError(
          'La ambulancia ya tiene un turno activo',
        );
      }
      return tx.turno.create({
        data: {
          id: turno.id,
          ambulanciaId: turno.ambulanciaId,
          inicio: turno.inicio,
          estado: turno.estado,
          integrantes: {
            create: turno.integrantes.map((i) => ({
              usuarioId: i.usuarioId,
              funcion: i.funcion,
            })),
          },
        },
        select: seleccionTurno,
      });
    });
    return this.aEntidad(registro);
  }

  async reemplazarIntegrantes(turno: Turno): Promise<Turno> {
    const registro = await this.prisma.$transaction(async (tx) => {
      await tx.turnoIntegrante.deleteMany({ where: { turnoId: turno.id } });
      await tx.turnoIntegrante.createMany({
        data: turno.integrantes.map((i) => ({
          turnoId: turno.id,
          usuarioId: i.usuarioId,
          funcion: i.funcion,
        })),
      });
      return tx.turno.findUniqueOrThrow({
        where: { id: turno.id },
        select: seleccionTurno,
      });
    });
    return this.aEntidad(registro);
  }

  async finalizar(turno: Turno): Promise<Turno> {
    const { count } = await this.prisma.turno.updateMany({
      where: { id: turno.id, estado: 'activo' },
      data: { estado: turno.estado, fin: turno.fin },
    });
    if (count === 0) {
      throw new ConflictoNegocioError('El turno ya fue finalizado');
    }
    const registro = await this.prisma.turno.findUniqueOrThrow({
      where: { id: turno.id },
      select: seleccionTurno,
    });
    return this.aEntidad(registro);
  }

  private aEntidad(registro: RegistroTurno): Turno {
    return Turno.reconstruir({
      id: registro.id,
      ambulanciaId: registro.ambulanciaId,
      ambulanciaCodigo: registro.ambulancia.codigo,
      inicio: registro.inicio,
      fin: registro.fin,
      estado: this.validar(ESTADOS_TURNO, registro.estado),
      integrantes: registro.integrantes.map((i) => ({
        usuarioId: i.usuarioId,
        funcion: this.validar(FUNCIONES_TRIPULANTE, i.funcion),
        nombreCompleto: `${i.usuario.nombres} ${i.usuario.apellidos}`,
      })),
    });
  }

  private validar<T extends string>(validos: readonly T[], valor: string): T {
    const encontrado = validos.find((valido) => valido === valor);
    if (encontrado === undefined) {
      throw new Error(
        `Valor de turno desconocido en la base de datos: ${valor}`,
      );
    }
    return encontrado;
  }
}
