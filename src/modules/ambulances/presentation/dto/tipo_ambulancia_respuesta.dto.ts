import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { TipoAmbulancia } from '../../domain/entities/tipo_ambulancia.entity.js';

export class TipoAmbulanciaRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'TAB' })
  nombre: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Básica' })
  descripcion: string | null;

  static desde(tipo: TipoAmbulancia): TipoAmbulanciaRespuestaDto {
    return { id: tipo.id, nombre: tipo.nombre, descripcion: tipo.descripcion };
  }
}
