import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ResultadoPaginado } from '../../../../common/types/resultado_paginado.js';
import {
  type Ambulancia,
  ESTADOS_OPERATIVOS,
  type EstadoOperativo,
} from '../../domain/entities/ambulancia.entity.js';
import { TipoAmbulanciaRespuestaDto } from './tipo_ambulancia_respuesta.dto.js';

export class UbicacionRespuestaDto {
  @ApiProperty({ example: 4.6097102 })
  latitud: number;

  @ApiProperty({ example: -74.081749 })
  longitud: number;

  @ApiProperty()
  registradaEn: Date;
}

export class AmbulanciaRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'AMB-01' })
  codigo: string;

  @ApiProperty({ example: 'ABC123' })
  placa: string;

  @ApiProperty({ type: TipoAmbulanciaRespuestaDto })
  tipo: TipoAmbulanciaRespuestaDto;

  @ApiProperty({ enum: ESTADOS_OPERATIVOS })
  estadoOperativo: EstadoOperativo;

  @ApiPropertyOptional({ type: UbicacionRespuestaDto, nullable: true })
  ultimaUbicacion: UbicacionRespuestaDto | null;

  @ApiProperty()
  creadaEn: Date;

  static desde(ambulancia: Ambulancia): AmbulanciaRespuestaDto {
    return {
      id: ambulancia.id,
      codigo: ambulancia.codigo,
      placa: ambulancia.placa,
      tipo: TipoAmbulanciaRespuestaDto.desde(ambulancia.tipo),
      estadoOperativo: ambulancia.estadoOperativo,
      ultimaUbicacion: ambulancia.ultimaUbicacion,
      creadaEn: ambulancia.creadaEn,
    };
  }
}

export class AmbulanciasPaginadasRespuestaDto {
  @ApiProperty({ type: [AmbulanciaRespuestaDto] })
  datos: AmbulanciaRespuestaDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  pagina: number;

  @ApiProperty()
  limite: number;

  static desde(
    resultado: ResultadoPaginado<Ambulancia>,
  ): AmbulanciasPaginadasRespuestaDto {
    return {
      ...resultado,
      datos: resultado.datos.map((ambulancia) =>
        AmbulanciaRespuestaDto.desde(ambulancia),
      ),
    };
  }
}
