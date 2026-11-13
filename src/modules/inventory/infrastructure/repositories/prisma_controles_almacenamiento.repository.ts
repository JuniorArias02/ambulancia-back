import { Injectable } from '@nestjs/common';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import { PrismaService } from '../../../../database/prisma.service.js';
import type { Prisma } from '../../../../generated/prisma/client.js';
import type { ControlAlmacenamiento } from '../../domain/entities/control_almacenamiento.entity.js';
import {
  ControlesAlmacenamientoRepositorio,
  type FiltrosControlesAlmacenamiento,
} from '../../domain/repositories/controles_almacenamiento.repository.js';
import {
  aNumero,
  nombreCompleto,
  nombreUbicacion,
  rangoDiasColombia,
  seleccionNombreUbicacion,
} from './conversiones.js';

const seleccion = {
  id: true,
  ubicacionId: true,
  usuarioId: true,
  temperatura: true,
  humedad: true,
  registradoEn: true,
  observaciones: true,
  creadoEn: true,
  ubicacion: { select: seleccionNombreUbicacion },
  usuario: { select: { nombres: true, apellidos: true } },
} satisfies Prisma.ControlAlmacenamientoSelect;

type Registro = Prisma.ControlAlmacenamientoGetPayload<{
  select: typeof seleccion;
}>;

@Injectable()
export class PrismaControlesAlmacenamientoRepositorio extends ControlesAlmacenamientoRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async registrar(
    control: ControlAlmacenamiento,
  ): Promise<ControlAlmacenamiento> {
    const registro = await this.prisma.controlAlmacenamiento.create({
      data: {
        id: control.id,
        ubicacionId: control.ubicacionId,
        usuarioId: control.usuarioId,
        temperatura: control.temperatura,
        humedad: control.humedad,
        registradoEn: control.registradoEn,
        observaciones: control.observaciones,
        creadoEn: control.creadoEn,
      },
      select: seleccion,
    });
    return this.aControl(registro);
  }

  async listar(
    filtros: FiltrosControlesAlmacenamiento,
    { pagina, limite }: Paginacion,
  ): Promise<ResultadoPaginado<ControlAlmacenamiento>> {
    const where: Prisma.ControlAlmacenamientoWhereInput = {
      ubicacionId: filtros.ubicacionId,
      registradoEn: rangoDiasColombia(filtros.desde, filtros.hasta),
    };
    const [total, registros] = await this.prisma.$transaction([
      this.prisma.controlAlmacenamiento.count({ where }),
      this.prisma.controlAlmacenamiento.findMany({
        where,
        select: seleccion,
        orderBy: { registradoEn: 'desc' },
        skip: (pagina - 1) * limite,
        take: limite,
      }),
    ]);
    return {
      datos: registros.map((r) => this.aControl(r)),
      total,
      pagina,
      limite,
    };
  }

  private aControl(registro: Registro): ControlAlmacenamiento {
    return {
      id: registro.id,
      ubicacionId: registro.ubicacionId,
      usuarioId: registro.usuarioId,
      temperatura: aNumero(registro.temperatura),
      humedad: aNumero(registro.humedad),
      registradoEn: registro.registradoEn,
      observaciones: registro.observaciones,
      creadoEn: registro.creadoEn,
      ubicacionNombre: nombreUbicacion(registro.ubicacion),
      usuarioNombre: nombreCompleto(registro.usuario),
    };
  }
}
