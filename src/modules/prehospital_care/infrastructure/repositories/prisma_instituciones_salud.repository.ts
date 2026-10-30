import { Injectable } from '@nestjs/common';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import { PrismaService } from '../../../../database/prisma.service.js';
import type { Prisma } from '../../../../generated/prisma/client.js';
import {
  InstitucionSalud,
  NIVELES_COMPLEJIDAD,
} from '../../domain/entities/institucion_salud.entity.js';
import {
  type FiltrosInstituciones,
  InstitucionesSaludRepositorio,
} from '../../domain/repositories/instituciones_salud.repository.js';

const seleccionInstitucion = {
  id: true,
  nombre: true,
  codigoHabilitacion: true,
  nivelComplejidad: true,
  telefono: true,
  direccion: true,
  latitud: true,
  longitud: true,
  activa: true,
} satisfies Prisma.InstitucionSaludSelect;

type RegistroInstitucion = Prisma.InstitucionSaludGetPayload<{
  select: typeof seleccionInstitucion;
}>;

@Injectable()
export class PrismaInstitucionesSaludRepositorio extends InstitucionesSaludRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async buscarPorId(id: string): Promise<InstitucionSalud | null> {
    const registro = await this.prisma.institucionSalud.findUnique({
      where: { id },
      select: seleccionInstitucion,
    });
    return registro ? this.aEntidad(registro) : null;
  }

  async existeCodigoHabilitacion(
    codigo: string,
    excluirId?: string,
  ): Promise<boolean> {
    const total = await this.prisma.institucionSalud.count({
      where: {
        codigoHabilitacion: codigo,
        id: excluirId ? { not: excluirId } : undefined,
      },
    });
    return total > 0;
  }

  async listar(
    filtros: FiltrosInstituciones,
    { pagina, limite }: Paginacion,
  ): Promise<ResultadoPaginado<InstitucionSalud>> {
    const where = this.where(filtros);
    const [total, registros] = await this.prisma.$transaction([
      this.prisma.institucionSalud.count({ where }),
      this.prisma.institucionSalud.findMany({
        where,
        select: seleccionInstitucion,
        orderBy: { nombre: 'asc' },
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

  async listarTodas(
    filtros: FiltrosInstituciones,
  ): Promise<InstitucionSalud[]> {
    const registros = await this.prisma.institucionSalud.findMany({
      where: this.where(filtros),
      select: seleccionInstitucion,
    });
    return registros.map((registro) => this.aEntidad(registro));
  }

  async crear(institucion: InstitucionSalud): Promise<InstitucionSalud> {
    const registro = await this.prisma.institucionSalud.create({
      data: { id: institucion.id, ...this.datos(institucion) },
      select: seleccionInstitucion,
    });
    return this.aEntidad(registro);
  }

  async actualizar(institucion: InstitucionSalud): Promise<InstitucionSalud> {
    const registro = await this.prisma.institucionSalud.update({
      where: { id: institucion.id },
      data: this.datos(institucion),
      select: seleccionInstitucion,
    });
    return this.aEntidad(registro);
  }

  private where(
    filtros: FiltrosInstituciones,
  ): Prisma.InstitucionSaludWhereInput {
    return {
      activa: filtros.activa,
      nivelComplejidad: filtros.nivelComplejidad,
      OR: filtros.busqueda
        ? [
            { nombre: { contains: filtros.busqueda } },
            { codigoHabilitacion: { contains: filtros.busqueda } },
            { direccion: { contains: filtros.busqueda } },
          ]
        : undefined,
    };
  }

  private datos(institucion: InstitucionSalud) {
    return {
      nombre: institucion.nombre,
      codigoHabilitacion: institucion.codigoHabilitacion,
      nivelComplejidad: institucion.nivelComplejidad,
      telefono: institucion.telefono,
      direccion: institucion.direccion,
      latitud: institucion.coordenadas?.latitud ?? null,
      longitud: institucion.coordenadas?.longitud ?? null,
      activa: institucion.activa,
    };
  }

  private aEntidad(registro: RegistroInstitucion): InstitucionSalud {
    const nivel = NIVELES_COMPLEJIDAD.find(
      (valido) => valido === registro.nivelComplejidad,
    );
    return InstitucionSalud.reconstruir({
      id: registro.id,
      nombre: registro.nombre,
      codigoHabilitacion: registro.codigoHabilitacion,
      // Datos cargados a mano con otro valor se muestran sin nivel en vez de romper.
      nivelComplejidad: nivel ?? null,
      telefono: registro.telefono,
      direccion: registro.direccion,
      coordenadas:
        registro.latitud !== null && registro.longitud !== null
          ? {
              latitud: registro.latitud.toNumber(),
              longitud: registro.longitud.toNumber(),
            }
          : null,
      activa: registro.activa,
    });
  }
}
