import { Injectable } from '@nestjs/common';
import { Roles } from '../../../../common/constants/roles.js';
import { ConflictoNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import { PrismaService } from '../../../../database/prisma.service.js';
import { Prisma } from '../../../../generated/prisma/client.js';
import {
  Ciudadano,
  type EstadoCuenta,
  TIPOS_DOCUMENTO_CIUDADANO,
} from '../../domain/entities/ciudadano.entity.js';
import {
  type CambioVerificacion,
  type DocumentoIdentidad,
  ESTADOS_VERIFICACION,
  LADOS_DOCUMENTO,
  VerificacionIdentidad,
} from '../../domain/entities/verificacion_identidad.entity.js';
import {
  CiudadanosRepositorio,
  type FiltrosVerificaciones,
  type RegistroHistorialVerificacion,
} from '../../domain/repositories/ciudadanos.repository.js';

const seleccionDocumento = {
  id: true,
  lado: true,
  claveAlmacenamiento: true,
  tipoMime: true,
  tamanoBytes: true,
  huellaSha256: true,
  cargadoEn: true,
} satisfies Prisma.DocumentoIdentidadSelect;

const seleccionCiudadano = {
  id: true,
  nombres: true,
  apellidos: true,
  tipoDocumento: true,
  numeroDocumento: true,
  fechaNacimiento: true,
  correo: true,
  telefono: true,
  estado: true,
  creadoEn: true,
  verificacionIdentidad: {
    select: {
      id: true,
      estado: true,
      motivo: true,
      enviadaEn: true,
      revisadaPorId: true,
      revisadaEn: true,
      documentos: { where: { vigente: true }, select: seleccionDocumento },
    },
  },
} satisfies Prisma.UsuarioSelect;

type RegistroCiudadano = Prisma.UsuarioGetPayload<{
  select: typeof seleccionCiudadano;
}>;
type RegistroDocumento = Prisma.DocumentoIdentidadGetPayload<{
  select: typeof seleccionDocumento;
}>;
type Transaccion = Prisma.TransactionClient;

const SOLO_CIUDADANOS = { rol: { nombre: Roles.CIUDADANO } };

@Injectable()
export class PrismaCiudadanosRepositorio extends CiudadanosRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async existeCorreo(
    correo: string,
    excluirUsuarioId?: string,
  ): Promise<boolean> {
    // En toda la tabla: el correo identifica la cuenta para iniciar sesión.
    const total = await this.prisma.usuario.count({
      where: {
        correo,
        id: excluirUsuarioId ? { not: excluirUsuarioId } : undefined,
      },
    });
    return total > 0;
  }

  async existeDocumento(
    numeroDocumento: string,
    excluirUsuarioId?: string,
  ): Promise<boolean> {
    const total = await this.prisma.usuario.count({
      where: {
        numeroDocumento,
        id: excluirUsuarioId ? { not: excluirUsuarioId } : undefined,
      },
    });
    return total > 0;
  }

  async existeCiudadanoConDocumento(numeroDocumento: string): Promise<boolean> {
    const total = await this.prisma.usuario.count({
      where: { numeroDocumento, ...SOLO_CIUDADANOS },
    });
    return total > 0;
  }

  async registrar(
    ciudadano: Ciudadano,
    contrasenaHash: string,
    cambio: CambioVerificacion,
  ): Promise<Ciudadano> {
    const { verificacion } = ciudadano;
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.usuario.create({
          data: {
            id: ciudadano.id,
            ...this.datosIdentidad(ciudadano),
            correo: ciudadano.correo,
            telefono: ciudadano.telefono,
            contrasenaHash,
            estado: ciudadano.estadoCuenta,
            creadoEn: ciudadano.creadoEn,
            // El rol lo pone el backend; el cliente nunca lo envía.
            rol: { connect: { nombre: Roles.CIUDADANO } },
          },
        });
        await tx.verificacionIdentidad.create({
          data: {
            id: verificacion.id,
            usuarioId: ciudadano.id,
            estado: verificacion.estado,
            enviadaEn: verificacion.enviadaEn,
          },
        });
        await this.crearDocumentos(
          tx,
          verificacion.id,
          verificacion.documentos,
        );
        await this.crearHistorial(tx, verificacion.id, cambio);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictoNegocioError('El correo o el documento ya existen');
      }
      throw error;
    }
    return this.recargar(ciudadano.id);
  }

  async buscarPorUsuarioId(usuarioId: string): Promise<Ciudadano | null> {
    const registro = await this.prisma.usuario.findFirst({
      where: { id: usuarioId, ...SOLO_CIUDADANOS },
      select: seleccionCiudadano,
    });
    return registro ? this.aEntidad(registro) : null;
  }

  async actualizarContacto(ciudadano: Ciudadano): Promise<Ciudadano> {
    try {
      await this.prisma.usuario.update({
        where: { id: ciudadano.id },
        data: { correo: ciudadano.correo, telefono: ciudadano.telefono },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictoNegocioError('Ese correo ya está registrado');
      }
      throw error;
    }
    return this.recargar(ciudadano.id);
  }

  async registrarReenvio(
    ciudadano: Ciudadano,
    {
      nuevos,
      reemplazados,
      cambio,
    }: {
      nuevos: DocumentoIdentidad[];
      reemplazados: DocumentoIdentidad[];
      cambio: CambioVerificacion;
    },
  ): Promise<Ciudadano> {
    const { verificacion } = ciudadano;
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.cambiarEstado(tx, verificacion, cambio, {
          enviadaEn: verificacion.enviadaEn,
        });
        await tx.usuario.update({
          where: { id: ciudadano.id },
          data: this.datosIdentidad(ciudadano),
        });
        if (reemplazados.length > 0) {
          await tx.documentoIdentidad.updateMany({
            where: { id: { in: reemplazados.map((d) => d.id) }, vigente: true },
            data: { vigente: false, reemplazadoEn: cambio.ocurridoEn },
          });
        }
        await this.crearDocumentos(tx, verificacion.id, nuevos);
        await this.crearHistorial(tx, verificacion.id, cambio);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictoNegocioError(
          'Ya existe una cuenta con ese número de documento',
        );
      }
      throw error;
    }
    return this.recargar(ciudadano.id);
  }

  async registrarDecision(
    ciudadano: Ciudadano,
    cambio: CambioVerificacion,
  ): Promise<Ciudadano> {
    const { verificacion } = ciudadano;
    await this.prisma.$transaction(async (tx) => {
      await this.cambiarEstado(tx, verificacion, cambio, {
        revisadaPorId: verificacion.revisadaPorId,
        revisadaEn: verificacion.revisadaEn,
      });
      await this.crearHistorial(tx, verificacion.id, cambio);
    });
    return this.recargar(ciudadano.id);
  }

  async listar(
    { estado, busqueda }: FiltrosVerificaciones,
    { pagina, limite }: Paginacion,
  ): Promise<ResultadoPaginado<Ciudadano>> {
    const where: Prisma.UsuarioWhereInput = {
      ...SOLO_CIUDADANOS,
      verificacionIdentidad: estado ? { estado } : { isNot: null },
      OR: busqueda
        ? [
            { nombres: { contains: busqueda } },
            { apellidos: { contains: busqueda } },
            { numeroDocumento: { contains: busqueda } },
            { correo: { contains: busqueda } },
          ]
        : undefined,
    };
    const [total, registros] = await this.prisma.$transaction([
      this.prisma.usuario.count({ where }),
      this.prisma.usuario.findMany({
        where,
        select: seleccionCiudadano,
        // Primero las que más llevan esperando.
        orderBy: { verificacionIdentidad: { enviadaEn: 'asc' } },
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

  async buscarDocumento(
    usuarioId: string,
    documentoId: string,
  ): Promise<DocumentoIdentidad | null> {
    const registro = await this.prisma.documentoIdentidad.findFirst({
      where: { id: documentoId, verificacion: { usuarioId } },
      select: seleccionDocumento,
    });
    return registro ? this.aDocumento(registro) : null;
  }

  async listarHistorial(
    usuarioId: string,
  ): Promise<RegistroHistorialVerificacion[]> {
    const registros = await this.prisma.historialVerificacion.findMany({
      where: { verificacion: { usuarioId } },
      orderBy: { ocurridoEn: 'asc' },
      select: {
        id: true,
        estadoAnterior: true,
        estadoNuevo: true,
        motivo: true,
        observaciones: true,
        responsableId: true,
        ocurridoEn: true,
        responsable: { select: { nombres: true, apellidos: true } },
      },
    });
    return registros.map((r) => ({
      id: r.id,
      estadoAnterior:
        r.estadoAnterior === null ? null : this.estado(r.estadoAnterior),
      estadoNuevo: this.estado(r.estadoNuevo),
      motivo: r.motivo,
      observaciones: r.observaciones,
      responsableId: r.responsableId,
      responsableNombre: `${r.responsable.nombres} ${r.responsable.apellidos}`,
      ocurridoEn: r.ocurridoEn,
    }));
  }

  /** Control optimista: solo escribe si nadie cambió el estado entre la lectura y la escritura. */
  private async cambiarEstado(
    tx: Transaccion,
    verificacion: VerificacionIdentidad,
    cambio: CambioVerificacion,
    extras: Prisma.VerificacionIdentidadUncheckedUpdateManyInput,
  ): Promise<void> {
    const { count } = await tx.verificacionIdentidad.updateMany({
      where: {
        id: verificacion.id,
        estado: cambio.estadoAnterior ?? undefined,
      },
      data: {
        estado: verificacion.estado,
        motivo: verificacion.motivo,
        ...extras,
      },
    });
    if (count === 0) {
      throw new ConflictoNegocioError(
        'La verificación cambió mientras tanto; vuelva a consultarla',
      );
    }
  }

  private async crearDocumentos(
    tx: Transaccion,
    verificacionId: string,
    documentos: readonly DocumentoIdentidad[],
  ): Promise<void> {
    if (documentos.length === 0) return;
    await tx.documentoIdentidad.createMany({
      data: documentos.map((d) => ({ ...d, verificacionId })),
    });
  }

  private async crearHistorial(
    tx: Transaccion,
    verificacionId: string,
    cambio: CambioVerificacion,
  ): Promise<void> {
    await tx.historialVerificacion.create({
      data: { id: crypto.randomUUID(), verificacionId, ...cambio },
    });
  }

  private datosIdentidad(ciudadano: Ciudadano) {
    return {
      nombres: ciudadano.nombres,
      apellidos: ciudadano.apellidos,
      tipoDocumento: ciudadano.tipoDocumento,
      numeroDocumento: ciudadano.numeroDocumento,
      // DATE sin hora: se guarda la medianoche UTC del día de calendario.
      fechaNacimiento: new Date(`${ciudadano.fechaNacimiento}T00:00:00.000Z`),
    };
  }

  private async recargar(usuarioId: string): Promise<Ciudadano> {
    const registro = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
      select: seleccionCiudadano,
    });
    return this.aEntidad(registro);
  }

  private aEntidad(registro: RegistroCiudadano): Ciudadano {
    const verificacion = registro.verificacionIdentidad;
    if (
      !verificacion ||
      !registro.tipoDocumento ||
      !registro.numeroDocumento ||
      !registro.fechaNacimiento ||
      !registro.telefono
    ) {
      throw new Error(
        `Ciudadano ${registro.id} incompleto en la base de datos`,
      );
    }
    return Ciudadano.reconstruir({
      id: registro.id,
      nombres: registro.nombres,
      apellidos: registro.apellidos,
      tipoDocumento: this.validar(
        TIPOS_DOCUMENTO_CIUDADANO,
        registro.tipoDocumento,
        'tipo de documento',
      ),
      numeroDocumento: registro.numeroDocumento,
      fechaNacimiento: registro.fechaNacimiento.toISOString().slice(0, 10),
      correo: registro.correo,
      telefono: registro.telefono,
      estadoCuenta: this.validar<EstadoCuenta>(
        ['activo', 'inactivo', 'bloqueado'],
        registro.estado,
        'estado de cuenta',
      ),
      creadoEn: registro.creadoEn,
      verificacion: VerificacionIdentidad.reconstruir({
        id: verificacion.id,
        usuarioId: registro.id,
        estado: this.estado(verificacion.estado),
        motivo: verificacion.motivo,
        enviadaEn: verificacion.enviadaEn,
        revisadaPorId: verificacion.revisadaPorId,
        revisadaEn: verificacion.revisadaEn,
        documentos: verificacion.documentos.map((d) => this.aDocumento(d)),
      }),
    });
  }

  private aDocumento(registro: RegistroDocumento): DocumentoIdentidad {
    return {
      ...registro,
      lado: this.validar(LADOS_DOCUMENTO, registro.lado, 'lado del documento'),
    };
  }

  private estado(valor: string) {
    return this.validar(ESTADOS_VERIFICACION, valor, 'estado de verificación');
  }

  private validar<T extends string>(
    validos: readonly T[],
    valor: string,
    campo: string,
  ): T {
    const encontrado = validos.find((valido) => valido === valor);
    if (encontrado === undefined) {
      throw new Error(
        `Valor de ${campo} desconocido en la base de datos: ${valor}`,
      );
    }
    return encontrado;
  }
}
