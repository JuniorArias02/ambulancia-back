import { Module } from '@nestjs/common';
import { AuditoriaRepositorio } from './domain/repositories/auditoria.repository.js';
import { PrismaAuditoriaRepositorio } from './infrastructure/repositories/prisma_auditoria.repository.js';

@Module({
  providers: [
    { provide: AuditoriaRepositorio, useClass: PrismaAuditoriaRepositorio },
  ],
  exports: [AuditoriaRepositorio],
})
export class AuditModule {}
