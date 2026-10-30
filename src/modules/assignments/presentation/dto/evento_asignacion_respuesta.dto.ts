import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NOMBRES_ROLES,
  type NombreRol,
} from '../../../../common/constants/roles.js';
import {
  ESTADOS_ASIGNACION,
  type EstadoAsignacion,
} from '../../domain/entities/asignacion.entity.js';
import type { EventoAsignacion } from '../../domain/entities/evento_asignacion.entity.js';

class PosicionEventoDto {
  @ApiProperty()
  latitud: number;

  @ApiProperty()
  longitud: number;
}

class ResponsableEventoDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Pedro Díaz' })
  nombreCompleto: string | null;

  @ApiPropertyOptional({ enum: NOMBRES_ROLES, nullable: true })
  rol: NombreRol | null;
}

export class EventoAsignacionRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiPropertyOptional({ enum: ESTADOS_ASIGNACION, nullable: true })
  estadoAnterior: EstadoAsignacion | null;

  @ApiProperty({ enum: ESTADOS_ASIGNACION })
  estadoNuevo: EstadoAsignacion;

  @ApiProperty()
  ocurridoEn: Date;

  @ApiPropertyOptional({ type: ResponsableEventoDto, nullable: true })
  responsable: ResponsableEventoDto | null;

  @ApiPropertyOptional({ type: PosicionEventoDto, nullable: true })
  posicion: PosicionEventoDto | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  precisionMetros: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'Solo en la llegada: distancia a la emergencia al confirmar',
  })
  distanciaEscenaMetros: number | null;

  @ApiProperty({
    description: 'La llegada se confirmó fuera del radio, con motivo',
  })
  fueraDeRadio: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  observacion: string | null;

  static desde(evento: EventoAsignacion): EventoAsignacionRespuestaDto {
    return {
      id: evento.id,
      estadoAnterior: evento.estadoAnterior,
      estadoNuevo: evento.estadoNuevo,
      ocurridoEn: evento.ocurridoEn,
      responsable: evento.usuarioId
        ? {
            id: evento.usuarioId,
            nombreCompleto: evento.responsableNombre,
            rol: evento.rolResponsable,
          }
        : null,
      posicion: evento.posicion,
      precisionMetros: evento.precisionMetros,
      distanciaEscenaMetros: evento.distanciaEscenaMetros,
      fueraDeRadio: evento.fueraDeRadio,
      observacion: evento.observacion,
    };
  }
}
