import { Injectable } from '@nestjs/common';
import { ConflictoNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import { PrismaService } from '../../../../database/prisma.service.js';
import type { Prisma } from '../../../../generated/prisma/client.js';
import {
  type DetallePerfil,
  PerfilDotacion,
} from '../../domain/entities/perfil_dotacion.entity.js';
import {
  type FiltrosPerfilesDotacion,
  PerfilesDotacionRepositorio,
} from '../../domain/repositories/perfiles_dotacion.repository.js';
import { aFechaBd, aNumero, deFechaBd, esDuplicado } from './conversiones.js';

const seleccion = {
  id: true,
  tipoAmbulanciaId: true,
  codigo: true,
  nombre: true,
  version: true,
  descripcion: true,
  vigenteDesde: true,
  vigenteHasta: true,
  activo: true,
  creadoEn: true,
  actualizadoEn: true,
  tipoAmbulancia: { select: { nombre: true } },
  detalles: {
    select: {
      id: true,
      insumoId: true,
      cantidadRequerida: true,
      cantidadMinima: true,
      obligatorio: true,
      observaciones: true,
      insumo: {
        select: {
          codigo: true,
          nombre: true,
          unidadMedida: true,
          requiereSerie: true,
        },
      },
    },
    orderBy: { insumo: { nombre: 'asc' } },
  },
} satisfies Prisma.PerfilDotacionSelect;

type Registro = Prisma.PerfilDotacionGetPayload<{ select: typeof seleccion }>;

function datosDetalle(detalle: DetallePerfil) {
  return {
    insumoId: detalle.insumoId,
    cantidadRequerida: detalle.cantidadRequerida,
    cantidadMinima: detalle.cantidadMinima,
    obligatorio: detalle.obligatorio,
    observaciones: detalle.observaciones,
  };
}

@Injectable()
export class PrismaPerfilesDotacionRepositorio extends PerfilesDotacionRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async buscarPorId(id: string): Promise<PerfilDotacion | null> {
    const registro = await this.prisma.perfilDotacion.findUnique({
      where: { id },
      select: seleccion,
    });
    return registro ? this.aEntidad(registro) : null;
  }

  async siguienteVersion(
    tipoAmbulanciaId: string,
    codigo: string,
  ): Promise<number> {
    const { _max } = await this.prisma.perfilDotacion.aggregate({
      where: { tipoAmbulanciaId, codigo },
      _max: { version: true },
    });
    return (_max.version ?? 0) + 1;
  }

  async buscarActivoDeTipo(
    tipoAmbulanciaId: string,
  ): Promise<PerfilDotacion | null> {
    const registro = await this.prisma.perfilDotacion.findFirst({
      where: { tipoAmbulanciaId, activo: true },
      select: seleccion,
      orderBy: { version: 'desc' },
    });
    return registro ? this.aEntidad(registro) : null;
  }

  async listar(
    filtros: FiltrosPerfilesDotacion,
    { pagina, limite }: Paginacion,
  ): Promise<ResultadoPaginado<PerfilDotacion>> {
    const where: Prisma.PerfilDotacionWhereInput = {
      tipoAmbulanciaId: filtros.tipoAmbulanciaId,
      activo: filtros.activo,
      codigo: filtros.codigo,
    };
    const [total, registros] = await this.prisma.$transaction([
      this.prisma.perfilDotacion.count({ where }),
      this.prisma.perfilDotacion.findMany({
        where,
        select: seleccion,
        orderBy: [{ codigo: 'asc' }, { version: 'desc' }],
        skip: (pagina - 1) * limite,
        take: limite,
      }),
    ]);
    return {
      datos: registros.map((r) => this.aEntidad(r)),
      total,
      pagina,
      limite,
    };
  }

  async crear(perfil: PerfilDotacion): Promise<PerfilDotacion> {
    try {
      await this.prisma.perfilDotacion.create({
        data: {
          id: perfil.id,
          tipoAmbulanciaId: perfil.tipoAmbulanciaId,
          codigo: perfil.codigo,
          version: perfil.version,
          creadoEn: perfil.creadoEn,
          ...this.datos(perfil),
          detalles: {
            create: perfil.detalles.map((d) => ({
              id: d.id,
              ...datosDetalle(d),
            })),
          },
        },
      });
    } catch (error) {
      if (esDuplicado(error)) {
        throw new ConflictoNegocioError(
          `La versión ${perfil.version} del perfil ${perfil.codigo} ya existe; intente de nuevo`,
        );
      }
      throw error;
    }
    return this.recargar(perfil.id);
  }

  async guardar(perfil: PerfilDotacion): Promise<PerfilDotacion> {
    await this.prisma.$transaction(async (tx) => {
      await tx.perfilDotacion.update({
        where: { id: perfil.id },
        data: this.datos(perfil),
      });
      await tx.detallePerfilDotacion.deleteMany({
        where: {
          perfilDotacionId: perfil.id,
          id: { notIn: perfil.detalles.map((d) => d.id) },
        },
      });
      for (const detalle of perfil.detalles) {
        await tx.detallePerfilDotacion.upsert({
          where: { id: detalle.id },
          create: {
            id: detalle.id,
            perfilDotacionId: perfil.id,
            ...datosDetalle(detalle),
          },
          update: datosDetalle(detalle),
        });
      }
    });
    return this.recargar(perfil.id);
  }

  async activarUnico(perfil: PerfilDotacion): Promise<PerfilDotacion> {
    await this.prisma.$transaction(async (tx) => {
      // Serializa las activaciones del mismo tipo: nunca quedan dos activos.
      await tx.$queryRaw`SELECT id FROM tipos_ambulancia WHERE id = ${perfil.tipoAmbulanciaId} FOR UPDATE`;
      await tx.perfilDotacion.updateMany({
        where: {
          tipoAmbulanciaId: perfil.tipoAmbulanciaId,
          activo: true,
          id: { not: perfil.id },
        },
        data: { activo: false },
      });
      await tx.perfilDotacion.update({
        where: { id: perfil.id },
        data: this.datos(perfil),
      });
    });
    return this.recargar(perfil.id);
  }

  private datos(perfil: PerfilDotacion) {
    return {
      nombre: perfil.nombre,
      descripcion: perfil.descripcion,
      vigenteDesde: aFechaBd(perfil.vigenteDesde),
      vigenteHasta: aFechaBd(perfil.vigenteHasta),
      activo: perfil.activo,
    };
  }

  private async recargar(id: string): Promise<PerfilDotacion> {
    const registro = await this.prisma.perfilDotacion.findUniqueOrThrow({
      where: { id },
      select: seleccion,
    });
    return this.aEntidad(registro);
  }

  private aEntidad(registro: Registro): PerfilDotacion {
    return PerfilDotacion.reconstruir({
      id: registro.id,
      tipoAmbulanciaId: registro.tipoAmbulanciaId,
      tipoAmbulanciaNombre: registro.tipoAmbulancia.nombre,
      codigo: registro.codigo,
      nombre: registro.nombre,
      version: registro.version,
      descripcion: registro.descripcion,
      vigenteDesde: deFechaBd(registro.vigenteDesde),
      vigenteHasta: deFechaBd(registro.vigenteHasta),
      activo: registro.activo,
      creadoEn: registro.creadoEn,
      actualizadoEn: registro.actualizadoEn,
      detalles: registro.detalles.map((d) => ({
        id: d.id,
        insumoId: d.insumoId,
        cantidadRequerida: aNumero(d.cantidadRequerida),
        cantidadMinima: aNumero(d.cantidadMinima),
        obligatorio: d.obligatorio,
        observaciones: d.observaciones,
        insumoCodigo: d.insumo.codigo,
        insumoNombre: d.insumo.nombre,
        unidadMedida: d.insumo.unidadMedida,
        soloEnteros: d.insumo.requiereSerie,
      })),
    });
  }
}
