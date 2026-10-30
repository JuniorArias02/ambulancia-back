import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Ubicacion } from '../../domain/entities/ubicacion.entity.js';

export class UbicacionRegistradaRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  ambulanciaId: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  asignacionId: string | null;

  @ApiProperty()
  latitud: number;

  @ApiProperty()
  longitud: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  velocidad: number | null;

  @ApiProperty()
  registradaEn: Date;

  static desde(ubicacion: Ubicacion): UbicacionRegistradaRespuestaDto {
    return { ...ubicacion };
  }
}
