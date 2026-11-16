import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service.js';
import type { DatosHistoria } from '../../domain/entities/historia_clinica.entity.js';
import { documentoEnlazable } from '../../domain/pacientes.js';
import { IndicePacientes } from '../../domain/repositories/indice_pacientes.repository.js';

@Injectable()
export class PrismaIndicePacientes extends IndicePacientes {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async enlazar(
    historiaId: string,
    datos: Readonly<DatosHistoria>,
  ): Promise<void> {
    const documento = documentoEnlazable(datos);
    if (!documento) {
      await this.prisma.historiaClinica.update({
        where: { id: historiaId },
        data: { pacienteId: null },
      });
      return;
    }
    // Lo vacío no borra lo que ya se sabía del paciente.
    const conocidos = {
      ...(datos.nombres && { nombres: datos.nombres }),
      ...(datos.apellidos && { apellidos: datos.apellidos }),
      ...(datos.sexo && { sexo: datos.sexo }),
      ...(datos.fechaNacimiento && { fechaNacimiento: datos.fechaNacimiento }),
    };
    await this.prisma.$transaction(async (tx) => {
      const paciente = await tx.paciente.upsert({
        where: { tipoDocumento_numeroDocumento: documento },
        create: { ...documento, ...conocidos },
        update: conocidos,
        select: { id: true },
      });
      await tx.historiaClinica.update({
        where: { id: historiaId },
        data: { pacienteId: paciente.id },
      });
    });
  }
}
