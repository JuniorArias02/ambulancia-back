import { Injectable } from '@nestjs/common';
import { ConflictoNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import { PrismaService } from '../../../../database/prisma.service.js';
import type { Prisma } from '../../../../generated/prisma/client.js';
import type { Ambulancia } from '../../domain/entities/ambulancia.entity.js';
import type { CambioEstadoAmbulancia } from '../../domain/entities/cambio_estado_ambulancia.entity.js';
import {
  ESTADOS_TURNO,
  FUNCIONES_TRIPULANTE,
  type NuevoIntegrante,
  Turno,
} from '../../domain/entities/turno.entity.js';
import {
  type BloqueoTripulacion,
  type FiltrosTurnos,
  type OperacionesTripulacion,
  TurnosRepositorio,
} from '../../domain/repositories/turnos.repository.js';
import {
  ambulanciaDesdeRegistro,
  seleccionAmbulancia,
} from './prisma_ambulancias.repository.js';

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

/** Con varias selecciones a la vez, la transacción espera su turno en el bloqueo. */
const OPCIONES_TRANSACCION = { maxWait: 5_000, timeout: 10_000 };

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
    return registro ? turnoDesdeRegistro(registro) : null;
  }

  async buscarActivoDeAmbulancia(ambulanciaId: string): Promise<Turno | null> {
    const registro = await this.prisma.turno.findFirst({
      where: { ambulanciaId, estado: 'activo' },
      select: seleccionTurno,
    });
    return registro ? turnoDesdeRegistro(registro) : null;
  }

  async buscarActivoDeUsuario(usuarioId: string): Promise<Turno | null> {
    const registro = await this.prisma.turno.findFirst({
      where: { estado: 'activo', integrantes: { some: { usuarioId } } },
      select: seleccionTurno,
    });
    return registro ? turnoDesdeRegistro(registro) : null;
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
      datos: registros.map((registro) => turnoDesdeRegistro(registro)),
      total,
      pagina,
      limite,
    };
  }

  async listarActivos(): Promise<Turno[]> {
    const registros = await this.prisma.turno.findMany({
      where: { estado: 'activo' },
      select: seleccionTurno,
    });
    return registros.map((registro) => turnoDesdeRegistro(registro));
  }

  enExclusiva<T>(
    { usuarioId, ambulanciaId }: BloqueoTripulacion,
    trabajo: (operaciones: OperacionesTripulacion) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      // Primero la ambulancia: al guardar el turno, la clave foránea también toma
      // las filas de sus otros tripulantes. En el orden inverso, dos personas de la
      // misma ambulancia se esperarían entre sí (deadlock probado con carga real).
      await tx.$queryRaw`SELECT id FROM ambulancias WHERE id = ${ambulanciaId} FOR UPDATE`;
      if (usuarioId) {
        await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${usuarioId} FOR UPDATE`;
      }
      return trabajo(new OperacionesTripulacionPrisma(tx));
    }, OPCIONES_TRANSACCION);
  }
}

class OperacionesTripulacionPrisma implements OperacionesTripulacion {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async buscarAmbulancia(id: string): Promise<Ambulancia | null> {
    const registro = await this.tx.ambulancia.findUnique({
      where: { id },
      select: seleccionAmbulancia,
    });
    return registro ? ambulanciaDesdeRegistro(registro) : null;
  }

  async buscarTurnoActivoDeAmbulancia(
    ambulanciaId: string,
  ): Promise<Turno | null> {
    const registro = await this.tx.turno.findFirst({
      where: { ambulanciaId, estado: 'activo' },
      select: seleccionTurno,
    });
    return registro ? turnoDesdeRegistro(registro) : null;
  }

  async buscarTurnoActivoDeUsuario(usuarioId: string): Promise<Turno | null> {
    const registro = await this.tx.turno.findFirst({
      where: { estado: 'activo', integrantes: { some: { usuarioId } } },
      select: seleccionTurno,
    });
    return registro ? turnoDesdeRegistro(registro) : null;
  }

  async tieneServicios(turnoId: string): Promise<boolean> {
    return (await this.tx.asignacionServicio.count({ where: { turnoId } })) > 0;
  }

  async crearTurno(turno: Turno): Promise<Turno> {
    const registro = await this.tx.turno.create({
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
    return turnoDesdeRegistro(registro);
  }

  async agregarIntegrante(
    turnoId: string,
    { usuarioId, funcion }: NuevoIntegrante,
  ): Promise<Turno> {
    await this.tx.turnoIntegrante.create({
      data: { turnoId, usuarioId, funcion },
    });
    const registro = await this.tx.turno.findUniqueOrThrow({
      where: { id: turnoId },
      select: seleccionTurno,
    });
    return turnoDesdeRegistro(registro);
  }

  async finalizarTurno(turno: Turno): Promise<Turno> {
    const { count } = await this.tx.turno.updateMany({
      where: { id: turno.id, estado: 'activo' },
      data: { estado: turno.estado, fin: turno.fin },
    });
    if (count === 0) {
      throw new ConflictoNegocioError('El turno ya fue finalizado');
    }
    const registro = await this.tx.turno.findUniqueOrThrow({
      where: { id: turno.id },
      select: seleccionTurno,
    });
    return turnoDesdeRegistro(registro);
  }

  async cambiarEstadoAmbulancia(
    ambulancia: Ambulancia,
    cambio: CambioEstadoAmbulancia,
  ): Promise<void> {
    await this.tx.ambulancia.update({
      where: { id: ambulancia.id },
      data: { estadoOperativo: cambio.estadoNuevo },
    });
    await this.tx.estadoAmbulanciaHistorial.create({
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
  }
}

function turnoDesdeRegistro(registro: RegistroTurno): Turno {
  return Turno.reconstruir({
    id: registro.id,
    ambulanciaId: registro.ambulanciaId,
    ambulanciaCodigo: registro.ambulancia.codigo,
    inicio: registro.inicio,
    fin: registro.fin,
    estado: validarValor(ESTADOS_TURNO, registro.estado),
    integrantes: registro.integrantes.map((i) => ({
      usuarioId: i.usuarioId,
      funcion: validarValor(FUNCIONES_TRIPULANTE, i.funcion),
      nombreCompleto: `${i.usuario.nombres} ${i.usuario.apellidos}`,
    })),
  });
}

function validarValor<T extends string>(
  validos: readonly T[],
  valor: string,
): T {
  const encontrado = validos.find((valido) => valido === valor);
  if (encontrado === undefined) {
    throw new Error(`Valor de turno desconocido en la base de datos: ${valor}`);
  }
  return encontrado;
}
