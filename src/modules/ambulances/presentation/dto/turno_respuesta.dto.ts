import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ResultadoPaginado } from '../../../../common/types/resultado_paginado.js';
import {
  ESTADOS_TURNO,
  type EstadoTurno,
  FUNCIONES_TRIPULANTE,
  type FuncionTripulante,
  type Turno,
} from '../../domain/entities/turno.entity.js';

export class IntegranteRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  usuarioId: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Pedro Díaz' })
  nombreCompleto: string | null;

  @ApiProperty({ enum: FUNCIONES_TRIPULANTE })
  funcion: FuncionTripulante;
}

export class TurnoRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  ambulanciaId: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'AMB-01' })
  ambulanciaCodigo: string | null;

  @ApiProperty()
  inicio: Date;

  @ApiPropertyOptional({ type: Date, nullable: true })
  fin: Date | null;

  @ApiProperty({ enum: ESTADOS_TURNO })
  estado: EstadoTurno;

  @ApiProperty({ type: [IntegranteRespuestaDto] })
  integrantes: IntegranteRespuestaDto[];

  @ApiProperty({ description: 'Tiene conductor y quien atienda al paciente' })
  tripulacionCompleta: boolean;

  static desde(turno: Turno): TurnoRespuestaDto {
    return {
      id: turno.id,
      ambulanciaId: turno.ambulanciaId,
      ambulanciaCodigo: turno.ambulanciaCodigo,
      inicio: turno.inicio,
      fin: turno.fin,
      estado: turno.estado,
      integrantes: turno.integrantes.map((i) => ({
        usuarioId: i.usuarioId,
        nombreCompleto: i.nombreCompleto,
        funcion: i.funcion,
      })),
      tripulacionCompleta: turno.tieneTripulacionCompleta(),
    };
  }
}

export class TurnosPaginadosRespuestaDto {
  @ApiProperty({ type: [TurnoRespuestaDto] })
  datos: TurnoRespuestaDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  pagina: number;

  @ApiProperty()
  limite: number;

  static desde(
    resultado: ResultadoPaginado<Turno>,
  ): TurnosPaginadosRespuestaDto {
    return {
      ...resultado,
      datos: resultado.datos.map((turno) => TurnoRespuestaDto.desde(turno)),
    };
  }
}
