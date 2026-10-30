import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ResultadoPaginado } from '../../../../common/types/resultado_paginado.js';
import {
  ESTADOS_OPERATIVOS,
  type EstadoOperativo,
} from '../../domain/entities/ambulancia.entity.js';
import type { CambioEstadoAmbulancia } from '../../domain/entities/cambio_estado_ambulancia.entity.js';

export class CambioEstadoRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiPropertyOptional({ enum: ESTADOS_OPERATIVOS, nullable: true })
  estadoAnterior: EstadoOperativo | null;

  @ApiProperty({ enum: ESTADOS_OPERATIVOS })
  estadoNuevo: EstadoOperativo;

  @ApiPropertyOptional({ type: String, nullable: true })
  motivo: string | null;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  usuarioId: string | null;

  @ApiProperty()
  cambiadoEn: Date;

  static desde(cambio: CambioEstadoAmbulancia): CambioEstadoRespuestaDto {
    return {
      id: cambio.id,
      estadoAnterior: cambio.estadoAnterior,
      estadoNuevo: cambio.estadoNuevo,
      motivo: cambio.motivo,
      usuarioId: cambio.usuarioId,
      cambiadoEn: cambio.cambiadoEn,
    };
  }
}

export class HistorialEstadosRespuestaDto {
  @ApiProperty({ type: [CambioEstadoRespuestaDto] })
  datos: CambioEstadoRespuestaDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  pagina: number;

  @ApiProperty()
  limite: number;

  static desde(
    resultado: ResultadoPaginado<CambioEstadoAmbulancia>,
  ): HistorialEstadosRespuestaDto {
    return {
      ...resultado,
      datos: resultado.datos.map((cambio) =>
        CambioEstadoRespuestaDto.desde(cambio),
      ),
    };
  }
}
