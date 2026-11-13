import { ApiPropertyOptional } from '@nestjs/swagger';
import type { MiInventario } from '../../application/use-cases/operar_inventario_ambulancia.use-case.js';
import { DotacionRespuestaDto } from './existencia.dto.js';
import { VerificacionRespuestaDto } from './verificacion.dto.js';

export class MiInventarioRespuestaDto extends DotacionRespuestaDto {
  @ApiPropertyOptional({
    type: VerificacionRespuestaDto,
    nullable: true,
    description: 'La verificación en curso, si hay',
  })
  verificacionAbierta: VerificacionRespuestaDto | null;

  static desdeMiInventario(inventario: MiInventario): MiInventarioRespuestaDto {
    return Object.assign(DotacionRespuestaDto.desde(inventario), {
      verificacionAbierta: inventario.verificacionAbierta
        ? VerificacionRespuestaDto.desde(inventario.verificacionAbierta)
        : null,
    });
  }
}
