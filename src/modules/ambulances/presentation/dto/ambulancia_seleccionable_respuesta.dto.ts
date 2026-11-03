import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { AmbulanciaSeleccionable } from '../../application/use-cases/consultar_ambulancias_seleccionables.use-case.js';
import {
  ESTADOS_OPERATIVOS,
  type EstadoOperativo,
} from '../../domain/entities/ambulancia.entity.js';
import {
  MOTIVOS_NO_SELECCIONABLE,
  type MotivoNoSeleccionable,
} from '../../domain/entities/seleccion_ambulancia.js';
import {
  FUNCIONES_TRIPULANTE,
  type FuncionTripulante,
} from '../../domain/entities/turno.entity.js';
import { TipoAmbulanciaRespuestaDto } from './tipo_ambulancia_respuesta.dto.js';

export class TripulanteVisibleRespuestaDto {
  @ApiPropertyOptional({ type: String, nullable: true, example: 'Pedro Díaz' })
  nombreCompleto: string | null;

  @ApiProperty({ enum: FUNCIONES_TRIPULANTE })
  funcion: FuncionTripulante;
}

export class AmbulanciaSeleccionableRespuestaDto {
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

  @ApiProperty({ type: [TripulanteVisibleRespuestaDto] })
  tripulacion: TripulanteVisibleRespuestaDto[];

  @ApiProperty({ description: 'El usuario autenticado ya está en esta' })
  esMia: boolean;

  @ApiProperty({ description: 'Tiene cupo para la función del usuario' })
  seleccionable: boolean;

  @ApiPropertyOptional({
    enum: MOTIVOS_NO_SELECCIONABLE,
    nullable: true,
  })
  motivoNoSeleccionable: MotivoNoSeleccionable | null;

  static desde({
    ambulancia,
    turno,
    esMia,
    motivoNoSeleccionable,
  }: AmbulanciaSeleccionable): AmbulanciaSeleccionableRespuestaDto {
    return {
      id: ambulancia.id,
      codigo: ambulancia.codigo,
      placa: ambulancia.placa,
      tipo: TipoAmbulanciaRespuestaDto.desde(ambulancia.tipo),
      estadoOperativo: ambulancia.estadoOperativo,
      tripulacion: (turno?.integrantes ?? []).map((i) => ({
        nombreCompleto: i.nombreCompleto,
        funcion: i.funcion,
      })),
      esMia,
      seleccionable: !esMia && motivoNoSeleccionable === null,
      motivoNoSeleccionable,
    };
  }
}
