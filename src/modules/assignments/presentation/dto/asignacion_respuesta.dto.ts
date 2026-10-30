import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ResultadoPaginado } from '../../../../common/types/resultado_paginado.js';
import { TurnoRespuestaDto } from '../../../ambulances/presentation/dto/turno_respuesta.dto.js';
import { EmergenciaRespuestaDto } from '../../../emergencies/presentation/dto/emergencia_respuesta.dto.js';
import {
  Asignacion,
  ESTADOS_ASIGNACION,
  ESTADOS_AVANCE,
  type EstadoAsignacion,
  type EstadoAvance,
} from '../../domain/entities/asignacion.entity.js';
import type { MiServicio } from '../../application/use-cases/obtener_mi_servicio.use-case.js';

export class AsignadaPorRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  nombreCompleto: string | null;
}

export class AsignacionRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  emergenciaId: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'EMG-20261024-0001',
  })
  numeroEmergencia: string | null;

  @ApiProperty({ format: 'uuid' })
  ambulanciaId: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'AMB-01' })
  ambulanciaCodigo: string | null;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  turnoId: string | null;

  @ApiProperty({ enum: ESTADOS_ASIGNACION })
  estado: EstadoAsignacion;

  @ApiProperty({
    enum: ESTADOS_AVANCE,
    isArray: true,
    description: 'Estados que se pueden marcar ahora (para pintar los botones)',
  })
  siguientesEstados: EstadoAvance[];

  @ApiPropertyOptional({ type: String, nullable: true })
  motivoCancelacion: string | null;

  @ApiPropertyOptional({ type: AsignadaPorRespuestaDto, nullable: true })
  asignadaPor: AsignadaPorRespuestaDto | null;

  @ApiProperty()
  asignadaEn: Date;

  @ApiPropertyOptional({ type: Date, nullable: true })
  salidaEn: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  llegadaEscenaEn: Date | null;

  @ApiPropertyOptional({
    type: Date,
    nullable: true,
    description: 'Inicio de la atención del paciente',
  })
  atencionInicioEn: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  salidaEscenaEn: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  llegadaDestinoEn: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  finalizadaEn: Date | null;

  static desde(asignacion: Asignacion): AsignacionRespuestaDto {
    return {
      id: asignacion.id,
      emergenciaId: asignacion.emergenciaId,
      numeroEmergencia: asignacion.numeroEmergencia,
      ambulanciaId: asignacion.ambulanciaId,
      ambulanciaCodigo: asignacion.ambulanciaCodigo,
      turnoId: asignacion.turnoId,
      estado: asignacion.estado,
      siguientesEstados: [...Asignacion.siguientesEstados(asignacion.estado)],
      motivoCancelacion: asignacion.motivoCancelacion,
      asignadaPor: asignacion.asignadaPorId
        ? {
            id: asignacion.asignadaPorId,
            nombreCompleto: asignacion.asignadaPorNombre,
          }
        : null,
      asignadaEn: asignacion.asignadaEn,
      salidaEn: asignacion.salidaEn,
      llegadaEscenaEn: asignacion.llegadaEscenaEn,
      atencionInicioEn: asignacion.atencionInicioEn,
      salidaEscenaEn: asignacion.salidaEscenaEn,
      llegadaDestinoEn: asignacion.llegadaDestinoEn,
      finalizadaEn: asignacion.finalizadaEn,
    };
  }
}

export class AsignacionesPaginadasRespuestaDto {
  @ApiProperty({ type: [AsignacionRespuestaDto] })
  datos: AsignacionRespuestaDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  pagina: number;

  @ApiProperty()
  limite: number;

  static desde(
    resultado: ResultadoPaginado<Asignacion>,
  ): AsignacionesPaginadasRespuestaDto {
    return {
      ...resultado,
      datos: resultado.datos.map((a) => AsignacionRespuestaDto.desde(a)),
    };
  }
}

export class MiServicioRespuestaDto {
  @ApiPropertyOptional({
    type: TurnoRespuestaDto,
    nullable: true,
    description: 'null si el usuario no está en un turno activo',
  })
  turno: TurnoRespuestaDto | null;

  @ApiPropertyOptional({
    type: AsignacionRespuestaDto,
    nullable: true,
    description: 'null si la ambulancia no tiene un servicio en curso',
  })
  asignacion: AsignacionRespuestaDto | null;

  @ApiPropertyOptional({ type: EmergenciaRespuestaDto, nullable: true })
  emergencia: EmergenciaRespuestaDto | null;

  @ApiProperty({
    example: 100,
    description:
      'Radio de referencia para confirmar la llegada: la app resalta "Confirmar llegada" al entrar en él',
  })
  radioLlegadaMetros: number;

  static desde(servicio: MiServicio): MiServicioRespuestaDto {
    return {
      radioLlegadaMetros: servicio.radioLlegadaMetros,
      turno: servicio.turno ? TurnoRespuestaDto.desde(servicio.turno) : null,
      asignacion: servicio.asignacion
        ? AsignacionRespuestaDto.desde(servicio.asignacion)
        : null,
      emergencia: servicio.emergencia
        ? EmergenciaRespuestaDto.desde(servicio.emergencia)
        : null,
    };
  }
}
