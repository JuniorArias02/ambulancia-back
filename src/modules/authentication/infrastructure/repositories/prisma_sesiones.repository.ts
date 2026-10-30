import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service.js';
import { Sesion } from '../../domain/entities/sesion.entity.js';
import { SesionesRepositorio } from '../../domain/repositories/sesiones.repository.js';

@Injectable()
export class PrismaSesionesRepositorio extends SesionesRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async guardar(sesion: Sesion): Promise<void> {
    await this.prisma.sesion.create({
      data: {
        id: sesion.id,
        usuarioId: sesion.usuarioId,
        tokenHash: sesion.tokenHash,
        expiraEn: sesion.expiraEn,
        revocadaEn: sesion.revocadaEn,
        creadaEn: sesion.creadaEn,
      },
      select: { id: true },
    });
  }

  async buscarPorId(id: string): Promise<Sesion | null> {
    const registro = await this.prisma.sesion.findUnique({
      where: { id },
      select: {
        id: true,
        usuarioId: true,
        tokenHash: true,
        expiraEn: true,
        revocadaEn: true,
        creadaEn: true,
      },
    });
    return registro ? Sesion.reconstruir(registro) : null;
  }

  async revocar(id: string, fecha: Date): Promise<void> {
    await this.prisma.sesion.updateMany({
      where: { id, revocadaEn: null },
      data: { revocadaEn: fecha },
    });
  }

  async revocarTodasDelUsuario(usuarioId: string, fecha: Date): Promise<void> {
    await this.prisma.sesion.updateMany({
      where: { usuarioId, revocadaEn: null },
      data: { revocadaEn: fecha },
    });
  }
}
