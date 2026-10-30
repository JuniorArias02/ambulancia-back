import { Injectable } from '@nestjs/common';
import { ConflictoNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import { PrismaService } from '../../../../database/prisma.service.js';
import { Prisma } from '../../../../generated/prisma/client.js';
import {
  Emergencia,
  ESTADOS_ACTIVOS,
  ESTADOS_EMERGENCIA,
  type EstadoEmergencia,
  FUENTES_EMERGENCIA,
  PRIORIDADES_EMERGENCIA,
  TIPOS_INCIDENTE,
} from '../../domain/entities/emergencia.entity.js';
import {
  EmergenciasRepositorio,
  type FiltrosEmergencias,
  NumeroEmergenciaEnUsoError,
} from '../../domain/repositories/emergencias.repository.js';

const seleccionEmergencia = {
  id: true,
  numeroEmergencia: true,
  fuente: true,
  informanteNombre: true,
  informanteTelefono: true,
  descripcion: true,
  tipoIncidente: true,
  prioridad: true,
  direccion: true,
  referenciaLugar: true,
  latitud: true,
  longitud: true,
  numeroVictimas: true,
  estado: true,
  emergenciaPrincipalId: true,
  recibidaPorId: true,
  recibidaEn: true,
  cerradaEn: true,
  recibidaPor: { select: { nombres: true, apellidos: true } },
} satisfies Prisma.EmergenciaSelect;

type RegistroEmergencia = Prisma.EmergenciaGetPayload<{
  select: typeof seleccionEmergencia;
}>;

/** Tope de candidatas al buscar duplicados; la ventana de tiempo ya las acota. */
const MAXIMO_CANDIDATAS = 200;

@Injectable()
export class PrismaEmergenciasRepositorio extends EmergenciasRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async buscarPorId(id: string): Promise<Emergencia | null> {
    const registro = await this.prisma.emergencia.findUnique({
      where: { id },
      select: seleccionEmergencia,
    });
    return registro ? this.aEntidad(registro) : null;
  }

  async ultimoConsecutivo(prefijo: string): Promise<number> {
    const ultima = await this.prisma.emergencia.findFirst({
      where: { numeroEmergencia: { startsWith: prefijo } },
      orderBy: { numeroEmergencia: 'desc' },
      select: { numeroEmergencia: true },
    });
    return ultima ? Number(ultima.numeroEmergencia.slice(prefijo.length)) : 0;
  }

  async listar(
    filtros: FiltrosEmergencias,
    { pagina, limite }: Paginacion,
  ): Promise<ResultadoPaginado<Emergencia>> {
    const where: Prisma.EmergenciaWhereInput = {
      estado:
        filtros.estado ??
        (filtros.soloActivas ? { in: [...ESTADOS_ACTIVOS] } : undefined),
      prioridad: filtros.prioridad,
      tipoIncidente: filtros.tipoIncidente,
      recibidaEn:
        filtros.desde || filtros.hasta
          ? { gte: filtros.desde, lte: filtros.hasta }
          : undefined,
      OR: filtros.busqueda
        ? [
            { numeroEmergencia: { contains: filtros.busqueda } },
            { descripcion: { contains: filtros.busqueda } },
            { direccion: { contains: filtros.busqueda } },
            { informanteNombre: { contains: filtros.busqueda } },
            { informanteTelefono: { contains: filtros.busqueda } },
          ]
        : undefined,
    };

    const [total, registros] = await this.prisma.$transaction([
      this.prisma.emergencia.count({ where }),
      this.prisma.emergencia.findMany({
        where,
        select: seleccionEmergencia,
        orderBy: { recibidaEn: 'desc' },
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

  async crear(emergencia: Emergencia): Promise<Emergencia> {
    try {
      const registro = await this.prisma.emergencia.create({
        data: {
          id: emergencia.id,
          numeroEmergencia: emergencia.numeroEmergencia,
          ...this.datosEditables(emergencia),
          estado: emergencia.estado,
          recibidaPorId: emergencia.recibidaPorId,
          recibidaEn: emergencia.recibidaEn,
        },
        select: seleccionEmergencia,
      });
      return this.aEntidad(registro);
    } catch (error) {
      // numero_emergencia es la única columna única además del id.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new NumeroEmergenciaEnUsoError();
      }
      throw error;
    }
  }

  async actualizar(
    emergencia: Emergencia,
    estadoEsperado: EstadoEmergencia,
  ): Promise<Emergencia> {
    const registro = await this.prisma.$transaction(async (tx) => {
      // Solo escribe si nadie cambió el estado entre la lectura y la escritura.
      const { count } = await tx.emergencia.updateMany({
        where: { id: emergencia.id, estado: estadoEsperado },
        data: {
          ...this.datosEditables(emergencia),
          estado: emergencia.estado,
          emergenciaPrincipalId: emergencia.emergenciaPrincipalId,
          cerradaEn: emergencia.cerradaEn,
        },
      });
      if (count === 0) {
        throw new ConflictoNegocioError(
          'La emergencia cambió mientras tanto; vuelva a consultarla',
        );
      }
      return tx.emergencia.findUniqueOrThrow({
        where: { id: emergencia.id },
        select: seleccionEmergencia,
      });
    });
    return this.aEntidad(registro);
  }

  async listarActivasDesde(
    desde: Date,
    excluirId: string,
  ): Promise<Emergencia[]> {
    const registros = await this.prisma.emergencia.findMany({
      where: {
        id: { not: excluirId },
        estado: { in: [...ESTADOS_ACTIVOS] },
        emergenciaPrincipalId: null,
        recibidaEn: { gte: desde },
      },
      select: seleccionEmergencia,
      orderBy: { recibidaEn: 'desc' },
      take: MAXIMO_CANDIDATAS,
    });
    return registros.map((registro) => this.aEntidad(registro));
  }

  private datosEditables(emergencia: Emergencia) {
    return {
      fuente: emergencia.fuente,
      informanteNombre: emergencia.informanteNombre,
      informanteTelefono: emergencia.informanteTelefono,
      descripcion: emergencia.descripcion,
      tipoIncidente: emergencia.tipoIncidente,
      prioridad: emergencia.prioridad,
      direccion: emergencia.direccion,
      referenciaLugar: emergencia.referenciaLugar,
      latitud: emergencia.coordenadas?.latitud ?? null,
      longitud: emergencia.coordenadas?.longitud ?? null,
      numeroVictimas: emergencia.numeroVictimas,
    };
  }

  private aEntidad(registro: RegistroEmergencia): Emergencia {
    const { latitud, longitud, recibidaPor } = registro;

    return Emergencia.reconstruir({
      id: registro.id,
      numeroEmergencia: registro.numeroEmergencia,
      fuente: this.validar(FUENTES_EMERGENCIA, registro.fuente, 'fuente'),
      informanteNombre: registro.informanteNombre,
      informanteTelefono: registro.informanteTelefono,
      descripcion: registro.descripcion,
      tipoIncidente:
        registro.tipoIncidente === null
          ? null
          : this.validar(TIPOS_INCIDENTE, registro.tipoIncidente, 'tipo'),
      prioridad:
        registro.prioridad === null
          ? null
          : this.validar(
              PRIORIDADES_EMERGENCIA,
              registro.prioridad,
              'prioridad',
            ),
      direccion: registro.direccion,
      referenciaLugar: registro.referenciaLugar,
      // MySQL devuelve DECIMAL como objeto Decimal; el dominio usa number.
      coordenadas:
        latitud !== null && longitud !== null
          ? { latitud: latitud.toNumber(), longitud: longitud.toNumber() }
          : null,
      numeroVictimas: registro.numeroVictimas,
      estado: this.validar(ESTADOS_EMERGENCIA, registro.estado, 'estado'),
      emergenciaPrincipalId: registro.emergenciaPrincipalId,
      recibidaPorId: registro.recibidaPorId,
      recibidaPorNombre: recibidaPor
        ? `${recibidaPor.nombres} ${recibidaPor.apellidos}`
        : null,
      recibidaEn: registro.recibidaEn,
      cerradaEn: registro.cerradaEn,
    });
  }

  private validar<T extends string>(
    validos: readonly T[],
    valor: string,
    campo: string,
  ): T {
    const encontrado = validos.find((valido) => valido === valor);
    if (encontrado === undefined) {
      throw new Error(
        `Valor de ${campo} de emergencia desconocido en la base de datos: ${valor}`,
      );
    }
    return encontrado;
  }
}
