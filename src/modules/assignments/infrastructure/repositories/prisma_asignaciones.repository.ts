import { Injectable } from '@nestjs/common';
import { ConflictoNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import { PrismaService } from '../../../../database/prisma.service.js';
import type { NombreRol } from '../../../../common/constants/roles.js';
import { esRolValido } from '../../../../common/constants/roles.js';
import { Prisma } from '../../../../generated/prisma/client.js';
import type { EventoAsignacion } from '../../domain/entities/evento_asignacion.entity.js';
import {
  Asignacion,
  type DestinoAsignacion,
  ESTADOS_ACTIVOS_ASIGNACION,
  ESTADOS_ASIGNACION,
  ESTADOS_CON_DESTINO,
  type EstadoAsignacion,
} from '../../domain/entities/asignacion.entity.js';
import {
  AsignacionesRepositorio,
  type CambioAmbulancia,
  type CambioEmergencia,
  type FiltrosAsignaciones,
} from '../../domain/repositories/asignaciones.repository.js';

const seleccionAsignacion = {
  id: true,
  emergenciaId: true,
  ambulanciaId: true,
  turnoId: true,
  asignadaPorId: true,
  estado: true,
  motivoCancelacion: true,
  asignadaEn: true,
  salidaEn: true,
  llegadaEscenaEn: true,
  atencionInicioEn: true,
  salidaEscenaEn: true,
  llegadaDestinoEn: true,
  finalizadaEn: true,
  emergencia: { select: { numeroEmergencia: true } },
  ambulancia: { select: { codigo: true } },
  asignadaPor: { select: { nombres: true, apellidos: true } },
  destinoActualizadoPorId: true,
  destinoActualizadoEn: true,
  destinoActualizadoPor: { select: { nombres: true, apellidos: true } },
  institucionDestino: {
    select: {
      id: true,
      nombre: true,
      direccion: true,
      telefono: true,
      latitud: true,
      longitud: true,
    },
  },
} satisfies Prisma.AsignacionServicioSelect;

type RegistroAsignacion = Prisma.AsignacionServicioGetPayload<{
  select: typeof seleccionAsignacion;
}>;

const seleccionEvento = {
  id: true,
  asignacionId: true,
  estadoAnterior: true,
  estadoNuevo: true,
  usuarioId: true,
  rolResponsable: true,
  ocurridoEn: true,
  latitud: true,
  longitud: true,
  precisionMetros: true,
  distanciaEscenaMetros: true,
  fueraDeRadio: true,
  observacion: true,
  usuario: { select: { nombres: true, apellidos: true } },
} satisfies Prisma.EventoAsignacionSelect;

type RegistroEvento = Prisma.EventoAsignacionGetPayload<{
  select: typeof seleccionEvento;
}>;

type Transaccion = Prisma.TransactionClient;

@Injectable()
export class PrismaAsignacionesRepositorio extends AsignacionesRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async buscarPorId(id: string): Promise<Asignacion | null> {
    const registro = await this.prisma.asignacionServicio.findUnique({
      where: { id },
      select: seleccionAsignacion,
    });
    return registro ? this.aEntidad(registro) : null;
  }

  async buscarActivaDeAmbulancia(
    ambulanciaId: string,
  ): Promise<Asignacion | null> {
    const registro = await this.prisma.asignacionServicio.findFirst({
      where: { ambulanciaId, estado: { in: [...ESTADOS_ACTIVOS_ASIGNACION] } },
      select: seleccionAsignacion,
      orderBy: { asignadaEn: 'desc' },
    });
    return registro ? this.aEntidad(registro) : null;
  }

  contarActivasDeEmergencia(
    emergenciaId: string,
    excluirId: string,
  ): Promise<number> {
    return this.prisma.asignacionServicio.count({
      where: this.activasDeEmergencia(emergenciaId, excluirId),
    });
  }

  async listar(
    filtros: FiltrosAsignaciones,
    { pagina, limite }: Paginacion,
  ): Promise<ResultadoPaginado<Asignacion>> {
    const where: Prisma.AsignacionServicioWhereInput = {
      emergenciaId: filtros.emergenciaId,
      ambulanciaId: filtros.ambulanciaId,
      estado:
        filtros.estado ??
        (filtros.soloActivas
          ? { in: [...ESTADOS_ACTIVOS_ASIGNACION] }
          : undefined),
    };
    const [total, registros] = await this.prisma.$transaction([
      this.prisma.asignacionServicio.count({ where }),
      this.prisma.asignacionServicio.findMany({
        where,
        select: seleccionAsignacion,
        orderBy: { asignadaEn: 'desc' },
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

  async registrarDespacho(
    asignacion: Asignacion,
    evento: EventoAsignacion,
    ambulancia: CambioAmbulancia,
    emergencia: CambioEmergencia,
  ): Promise<Asignacion> {
    const registro = await this.prisma.$transaction(async (tx) => {
      await this.aplicarEmergencia(tx, emergencia, asignacion.id);
      await this.aplicarAmbulancia(tx, ambulancia);
      await this.exigirTurnoVigente(tx, asignacion);
      const creada = await tx.asignacionServicio.create({
        data: {
          id: asignacion.id,
          emergenciaId: asignacion.emergenciaId,
          ambulanciaId: asignacion.ambulanciaId,
          turnoId: asignacion.turnoId,
          asignadaPorId: asignacion.asignadaPorId,
          estado: asignacion.estado,
          asignadaEn: asignacion.asignadaEn,
        },
        select: seleccionAsignacion,
      });
      await this.crearEvento(tx, evento);
      return creada;
    });
    return this.aEntidad(registro);
  }

  async registrarTransicion(
    asignacion: Asignacion,
    estadoAnterior: EstadoAsignacion,
    evento: EventoAsignacion,
    efectos: { ambulancia?: CambioAmbulancia; emergencia?: CambioEmergencia },
  ): Promise<Asignacion> {
    const registro = await this.prisma.$transaction(async (tx) => {
      if (efectos.emergencia) {
        await this.aplicarEmergencia(tx, efectos.emergencia, asignacion.id);
      }

      const { count } = await tx.asignacionServicio.updateMany({
        where: { id: asignacion.id, estado: estadoAnterior },
        data: {
          estado: asignacion.estado,
          motivoCancelacion: asignacion.motivoCancelacion,
          salidaEn: asignacion.salidaEn,
          llegadaEscenaEn: asignacion.llegadaEscenaEn,
          atencionInicioEn: asignacion.atencionInicioEn,
          salidaEscenaEn: asignacion.salidaEscenaEn,
          llegadaDestinoEn: asignacion.llegadaDestinoEn,
          finalizadaEn: asignacion.finalizadaEn,
        },
      });
      if (count === 0) {
        throw new ConflictoNegocioError(
          'La asignación cambió mientras tanto; vuelva a consultarla',
        );
      }

      await this.crearEvento(tx, evento);
      if (efectos.ambulancia)
        await this.aplicarAmbulancia(tx, efectos.ambulancia);

      return tx.asignacionServicio.findUniqueOrThrow({
        where: { id: asignacion.id },
        select: seleccionAsignacion,
      });
    });
    return this.aEntidad(registro);
  }

  async registrarDestino(asignacion: Asignacion): Promise<Asignacion> {
    const { count } = await this.prisma.asignacionServicio.updateMany({
      where: { id: asignacion.id, estado: { in: [...ESTADOS_CON_DESTINO] } },
      data: {
        institucionDestinoId: asignacion.destino?.institucionId ?? null,
        destinoActualizadoPorId: asignacion.destinoActualizadoPorId,
        destinoActualizadoEn: asignacion.destinoActualizadoEn,
      },
    });
    if (count === 0) {
      throw new ConflictoNegocioError(
        'El servicio cambió de estado mientras tanto; vuelva a consultarlo',
      );
    }
    const registro = await this.prisma.asignacionServicio.findUniqueOrThrow({
      where: { id: asignacion.id },
      select: seleccionAsignacion,
    });
    return this.aEntidad(registro);
  }

  async listarEventos(asignacionId: string): Promise<EventoAsignacion[]> {
    const registros = await this.prisma.eventoAsignacion.findMany({
      where: { asignacionId },
      orderBy: { ocurridoEn: 'asc' },
      select: seleccionEvento,
    });
    return registros.map((registro) => this.aEvento(registro));
  }

  /**
   * La restricción única (asignación, estado) es la última defensa contra un
   * paso registrado dos veces (dos toques a la vez, reintentos sin señal).
   */
  private async crearEvento(
    tx: Transaccion,
    evento: EventoAsignacion,
  ): Promise<void> {
    try {
      await tx.eventoAsignacion.create({
        data: {
          id: evento.id,
          asignacionId: evento.asignacionId,
          estadoAnterior: evento.estadoAnterior,
          estadoNuevo: evento.estadoNuevo,
          usuarioId: evento.usuarioId,
          rolResponsable: evento.rolResponsable,
          ocurridoEn: evento.ocurridoEn,
          latitud: evento.posicion?.latitud ?? null,
          longitud: evento.posicion?.longitud ?? null,
          precisionMetros: evento.precisionMetros,
          distanciaEscenaMetros: evento.distanciaEscenaMetros,
          fueraDeRadio: evento.fueraDeRadio,
          observacion: evento.observacion,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictoNegocioError(
          `El paso "${evento.estadoNuevo}" ya estaba registrado para este servicio`,
        );
      }
      throw error;
    }
  }

  /** Cambia el estado de la ambulancia solo si sigue en el estado leído, y deja el historial. */
  /**
   * La tripulación pudo cambiar después de leer el turno. La ambulancia ya está
   * bloqueada; `FOR UPDATE` lee el estado confirmado, no la foto de la transacción.
   */
  private async exigirTurnoVigente(
    tx: Transaccion,
    { turnoId }: Asignacion,
  ): Promise<void> {
    const filas = await tx.$queryRaw<{ estado: string }[]>`
      SELECT estado FROM turnos WHERE id = ${turnoId} FOR UPDATE`;
    if (filas[0]?.estado !== 'activo') {
      throw new ConflictoNegocioError(
        'La tripulación de la ambulancia cambió mientras tanto; vuelva a intentarlo',
      );
    }
  }

  private async aplicarAmbulancia(
    tx: Transaccion,
    { ambulancia, cambio }: CambioAmbulancia,
  ): Promise<void> {
    const { count } = await tx.ambulancia.updateMany({
      where: {
        id: ambulancia.id,
        estadoOperativo: cambio.estadoAnterior ?? undefined,
      },
      data: { estadoOperativo: cambio.estadoNuevo },
    });
    if (count === 0) {
      throw new ConflictoNegocioError(
        `La ambulancia ${ambulancia.codigo} cambió de estado mientras tanto (ya no está ${cambio.estadoAnterior})`,
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
  }

  /**
   * Bloquea la fila de la emergencia para que dos servicios que terminan a la
   * vez no decidan los dos que "todavía queda otro activo".
   */
  private async aplicarEmergencia(
    tx: Transaccion,
    {
      emergencia,
      estadoAnterior,
      sinOtrasAsignacionesActivas,
    }: CambioEmergencia,
    asignacionId: string,
  ): Promise<void> {
    await tx.$queryRaw`SELECT id FROM emergencias WHERE id = ${emergencia.id} FOR UPDATE`;

    if (sinOtrasAsignacionesActivas !== undefined) {
      const otras = await tx.asignacionServicio.count({
        where: this.activasDeEmergencia(emergencia.id, asignacionId),
      });
      if ((otras === 0) !== sinOtrasAsignacionesActivas) {
        throw new ConflictoNegocioError(
          'Otro servicio de la emergencia cambió al mismo tiempo; intente de nuevo',
        );
      }
    }

    // Con la fila bloqueada basta leer el estado; si no cambia, no se escribe
    // (MySQL reporta 0 filas afectadas al escribir el mismo valor).
    const actual = await tx.emergencia.findUniqueOrThrow({
      where: { id: emergencia.id },
      select: { estado: true },
    });
    if (actual.estado !== estadoAnterior) {
      throw new ConflictoNegocioError(
        'La emergencia cambió mientras tanto; vuelva a consultarla',
      );
    }
    if (emergencia.estado !== estadoAnterior) {
      await tx.emergencia.update({
        where: { id: emergencia.id },
        data: { estado: emergencia.estado, cerradaEn: emergencia.cerradaEn },
      });
    }
  }

  private activasDeEmergencia(
    emergenciaId: string,
    excluirId: string,
  ): Prisma.AsignacionServicioWhereInput {
    return {
      emergenciaId,
      id: { not: excluirId },
      estado: { in: [...ESTADOS_ACTIVOS_ASIGNACION] },
    };
  }

  private aEntidad(registro: RegistroAsignacion): Asignacion {
    const estado = ESTADOS_ASIGNACION.find(
      (valido) => valido === registro.estado,
    );
    if (estado === undefined) {
      throw new Error(
        `Estado de asignación desconocido en la base de datos: ${registro.estado}`,
      );
    }
    return Asignacion.reconstruir({
      id: registro.id,
      emergenciaId: registro.emergenciaId,
      ambulanciaId: registro.ambulanciaId,
      turnoId: registro.turnoId,
      asignadaPorId: registro.asignadaPorId,
      estado,
      motivoCancelacion: registro.motivoCancelacion,
      asignadaEn: registro.asignadaEn,
      salidaEn: registro.salidaEn,
      llegadaEscenaEn: registro.llegadaEscenaEn,
      atencionInicioEn: registro.atencionInicioEn,
      salidaEscenaEn: registro.salidaEscenaEn,
      llegadaDestinoEn: registro.llegadaDestinoEn,
      finalizadaEn: registro.finalizadaEn,
      numeroEmergencia: registro.emergencia.numeroEmergencia,
      ambulanciaCodigo: registro.ambulancia.codigo,
      asignadaPorNombre: registro.asignadaPor
        ? `${registro.asignadaPor.nombres} ${registro.asignadaPor.apellidos}`
        : null,
      destino: this.aDestino(registro),
      destinoActualizadoPorId: registro.destinoActualizadoPorId,
      destinoActualizadoEn: registro.destinoActualizadoEn,
      destinoActualizadoPorNombre: registro.destinoActualizadoPor
        ? `${registro.destinoActualizadoPor.nombres} ${registro.destinoActualizadoPor.apellidos}`
        : null,
    });
  }

  private aDestino({
    institucionDestino: institucion,
  }: RegistroAsignacion): DestinoAsignacion | null {
    if (!institucion) return null;
    return {
      institucionId: institucion.id,
      nombre: institucion.nombre,
      direccion: institucion.direccion,
      telefono: institucion.telefono,
      coordenadas:
        institucion.latitud !== null && institucion.longitud !== null
          ? {
              latitud: institucion.latitud.toNumber(),
              longitud: institucion.longitud.toNumber(),
            }
          : null,
    };
  }

  private aEvento(registro: RegistroEvento): EventoAsignacion {
    return {
      id: registro.id,
      asignacionId: registro.asignacionId,
      estadoAnterior:
        registro.estadoAnterior === null
          ? null
          : this.validarEstado(registro.estadoAnterior),
      estadoNuevo: this.validarEstado(registro.estadoNuevo),
      usuarioId: registro.usuarioId,
      rolResponsable: rolConocido(registro.rolResponsable),
      ocurridoEn: registro.ocurridoEn,
      posicion:
        registro.latitud !== null && registro.longitud !== null
          ? {
              latitud: registro.latitud.toNumber(),
              longitud: registro.longitud.toNumber(),
            }
          : null,
      precisionMetros: registro.precisionMetros?.toNumber() ?? null,
      distanciaEscenaMetros: registro.distanciaEscenaMetros?.toNumber() ?? null,
      fueraDeRadio: registro.fueraDeRadio,
      observacion: registro.observacion,
      responsableNombre: registro.usuario
        ? `${registro.usuario.nombres} ${registro.usuario.apellidos}`
        : null,
    };
  }

  private validarEstado(estado: string): EstadoAsignacion {
    const valido = ESTADOS_ASIGNACION.find((e) => e === estado);
    if (valido === undefined) {
      throw new Error(
        `Estado de asignación desconocido en la base de datos: ${estado}`,
      );
    }
    return valido;
  }
}

function rolConocido(rol: string | null): NombreRol | null {
  return rol !== null && esRolValido(rol) ? rol : null;
}
