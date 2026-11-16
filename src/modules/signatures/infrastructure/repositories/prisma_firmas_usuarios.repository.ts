import { Injectable } from '@nestjs/common';
import { ConflictoNegocioError } from '../../../../common/exceptions/errores_dominio.js';
import { PrismaService } from '../../../../database/prisma.service.js';
import type { Prisma } from '../../../../generated/prisma/client.js';
import { FirmaUsuario } from '../../domain/entities/firma_usuario.entity.js';
import { FirmasUsuariosRepositorio } from '../../domain/repositories/firmas_usuarios.repository.js';

const seleccionFirma = {
  id: true,
  usuarioId: true,
  claveAlmacenamiento: true,
  tipoMime: true,
  tamanoBytes: true,
  anchoPx: true,
  altoPx: true,
  huellaSha256: true,
  vigente: true,
  registradaEn: true,
  reemplazadaEn: true,
  desactivadaEn: true,
  desactivadaPorId: true,
  motivoDesactivacion: true,
} satisfies Prisma.FirmaUsuarioSelect;

type RegistroFirma = Prisma.FirmaUsuarioGetPayload<{
  select: typeof seleccionFirma;
}>;

@Injectable()
export class PrismaFirmasUsuariosRepositorio extends FirmasUsuariosRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async buscarPorId(id: string): Promise<FirmaUsuario | null> {
    const registro = await this.prisma.firmaUsuario.findUnique({
      where: { id },
      select: seleccionFirma,
    });
    return registro ? aFirma(registro) : null;
  }

  async buscarVigente(usuarioId: string): Promise<FirmaUsuario | null> {
    const registro = await this.prisma.firmaUsuario.findFirst({
      where: { usuarioId, vigente: true },
      select: seleccionFirma,
    });
    return registro ? aFirma(registro) : null;
  }

  async listarDeUsuario(usuarioId: string): Promise<FirmaUsuario[]> {
    const registros = await this.prisma.firmaUsuario.findMany({
      where: { usuarioId },
      select: seleccionFirma,
      orderBy: { registradaEn: 'desc' },
    });
    return registros.map(aFirma);
  }

  async registrar(firma: FirmaUsuario): Promise<FirmaUsuario> {
    const creada = await this.prisma.$transaction(async (tx) => {
      // Bloquea al usuario: dos registros al mismo tiempo se atienden en orden
      // y nunca quedan dos firmas vigentes.
      await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${firma.usuarioId} FOR UPDATE`;
      await tx.firmaUsuario.updateMany({
        where: { usuarioId: firma.usuarioId, vigente: true },
        data: { vigente: false, reemplazadaEn: firma.registradaEn },
      });
      return tx.firmaUsuario.create({
        data: {
          id: firma.id,
          usuarioId: firma.usuarioId,
          claveAlmacenamiento: firma.claveAlmacenamiento,
          tipoMime: firma.tipoMime,
          tamanoBytes: firma.tamanoBytes,
          anchoPx: firma.anchoPx,
          altoPx: firma.altoPx,
          huellaSha256: firma.huellaSha256,
          vigente: true,
          registradaEn: firma.registradaEn,
        },
        select: seleccionFirma,
      });
    });
    return aFirma(creada);
  }

  async desactivar(firma: FirmaUsuario): Promise<FirmaUsuario> {
    const { count } = await this.prisma.firmaUsuario.updateMany({
      where: { id: firma.id, vigente: true },
      data: {
        vigente: false,
        desactivadaEn: firma.desactivadaEn,
        desactivadaPorId: firma.desactivadaPorId,
        motivoDesactivacion: firma.motivoDesactivacion,
      },
    });
    if (count === 0) {
      throw new ConflictoNegocioError(
        'La firma cambió mientras tanto (ya no está vigente)',
      );
    }
    const registro = await this.prisma.firmaUsuario.findUniqueOrThrow({
      where: { id: firma.id },
      select: seleccionFirma,
    });
    return aFirma(registro);
  }
}

function aFirma(r: RegistroFirma): FirmaUsuario {
  if (r.tipoMime !== 'image/png') {
    // La tabla tiene CHECK: si llega otro tipo, la base está dañada.
    throw new Error(`Firma con tipo desconocido: ${r.id}`);
  }
  return FirmaUsuario.reconstruir({ ...r, tipoMime: r.tipoMime });
}
