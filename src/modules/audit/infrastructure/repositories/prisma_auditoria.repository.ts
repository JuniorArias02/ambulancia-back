import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service.js';
import type { EventoAuditoria } from '../../domain/entities/evento_auditoria.entity.js';
import { AuditoriaRepositorio } from '../../domain/repositories/auditoria.repository.js';

@Injectable()
export class PrismaAuditoriaRepositorio extends AuditoriaRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async registrar(evento: EventoAuditoria): Promise<void> {
    await this.prisma.auditoriaEvento.create({
      data: {
        id: crypto.randomUUID(),
        usuarioId: evento.usuarioId,
        entidad: evento.entidad,
        entidadId: evento.entidadId,
        accion: evento.accion,
        // auditoria_eventos no tiene columna propia para la IP: va en el detalle.
        detalle:
          evento.direccionIp === null
            ? evento.detalle
            : { ...evento.detalle, direccionIp: evento.direccionIp },
      },
    });
  }
}
