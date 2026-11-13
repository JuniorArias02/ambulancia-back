import { Injectable } from '@nestjs/common';
import type {
  Paginacion,
  ResultadoPaginado,
} from '../../../../common/types/resultado_paginado.js';
import { PrismaService } from '../../../../database/prisma.service.js';
import type { Prisma } from '../../../../generated/prisma/client.js';
import {
  ESTADOS_REGISTRO_SANITARIO,
  RegistroSanitario,
  TIPOS_REGISTRO_SANITARIO,
} from '../../domain/entities/registro_sanitario.entity.js';
import {
  type FiltrosRegistrosSanitarios,
  RegistrosSanitariosRepositorio,
} from '../../domain/repositories/registros_sanitarios.repository.js';
import {
  aFechaBd,
  deFechaBd,
  siDuplicado,
  valorConocido,
} from './conversiones.js';

const seleccion = {
  id: true,
  insumoId: true,
  numeroRegistro: true,
  tipoRegistro: true,
  fechaExpedicion: true,
  fechaVencimiento: true,
  titular: true,
  documentoUrl: true,
  estado: true,
  creadoEn: true,
  actualizadoEn: true,
  insumo: { select: { nombre: true } },
} satisfies Prisma.RegistroSanitarioSelect;

type Registro = Prisma.RegistroSanitarioGetPayload<{
  select: typeof seleccion;
}>;

@Injectable()
export class PrismaRegistrosSanitariosRepositorio extends RegistrosSanitariosRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async buscarPorId(id: string): Promise<RegistroSanitario | null> {
    const registro = await this.prisma.registroSanitario.findUnique({
      where: { id },
      select: seleccion,
    });
    return registro ? this.aEntidad(registro) : null;
  }

  async existeNumero(
    insumoId: string,
    numeroRegistro: string,
    excluirId?: string,
  ): Promise<boolean> {
    const total = await this.prisma.registroSanitario.count({
      where: {
        insumoId,
        numeroRegistro,
        id: excluirId ? { not: excluirId } : undefined,
      },
    });
    return total > 0;
  }

  async listar(
    filtros: FiltrosRegistrosSanitarios,
    { pagina, limite }: Paginacion,
  ): Promise<ResultadoPaginado<RegistroSanitario>> {
    const where: Prisma.RegistroSanitarioWhereInput = {
      insumoId: filtros.insumoId,
      estado: filtros.estado,
      fechaVencimiento: filtros.vencenHasta
        ? { lte: aFechaBd(filtros.vencenHasta) }
        : undefined,
    };
    const [total, registros] = await this.prisma.$transaction([
      this.prisma.registroSanitario.count({ where }),
      this.prisma.registroSanitario.findMany({
        where,
        select: seleccion,
        orderBy: [{ fechaVencimiento: 'asc' }, { numeroRegistro: 'asc' }],
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

  async crear(registro: RegistroSanitario): Promise<RegistroSanitario> {
    const creado = await siDuplicado(
      () =>
        this.prisma.registroSanitario.create({
          data: {
            id: registro.id,
            insumoId: registro.insumoId,
            ...this.datos(registro),
            creadoEn: registro.creadoEn,
          },
          select: seleccion,
        }),
      `El registro ${registro.numeroRegistro} ya existe para este insumo`,
    );
    return this.aEntidad(creado);
  }

  async actualizar(registro: RegistroSanitario): Promise<RegistroSanitario> {
    const actualizado = await siDuplicado(
      () =>
        this.prisma.registroSanitario.update({
          where: { id: registro.id },
          data: this.datos(registro),
          select: seleccion,
        }),
      `El registro ${registro.numeroRegistro} ya existe para este insumo`,
    );
    return this.aEntidad(actualizado);
  }

  private datos(registro: RegistroSanitario) {
    return {
      numeroRegistro: registro.numeroRegistro,
      tipoRegistro: registro.tipoRegistro,
      fechaExpedicion: aFechaBd(registro.fechaExpedicion),
      fechaVencimiento: aFechaBd(registro.fechaVencimiento),
      titular: registro.titular,
      documentoUrl: registro.documentoUrl,
      estado: registro.estado,
    };
  }

  private aEntidad(registro: Registro): RegistroSanitario {
    return RegistroSanitario.reconstruir({
      id: registro.id,
      insumoId: registro.insumoId,
      numeroRegistro: registro.numeroRegistro,
      tipoRegistro: valorConocido(
        TIPOS_REGISTRO_SANITARIO,
        registro.tipoRegistro,
        'inv_registros_sanitarios.tipo_registro',
      ),
      fechaExpedicion: deFechaBd(registro.fechaExpedicion),
      fechaVencimiento: deFechaBd(registro.fechaVencimiento),
      titular: registro.titular,
      documentoUrl: registro.documentoUrl,
      estado: valorConocido(
        ESTADOS_REGISTRO_SANITARIO,
        registro.estado,
        'inv_registros_sanitarios.estado',
      ),
      creadoEn: registro.creadoEn,
      actualizadoEn: registro.actualizadoEn,
      insumoNombre: registro.insumo.nombre,
    });
  }
}
