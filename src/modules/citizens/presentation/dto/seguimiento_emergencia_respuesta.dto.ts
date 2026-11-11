import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { SeguimientoEmergencia } from '../../application/use-cases/obtener_seguimiento_emergencia.use-case.js';
import {
  ESTADOS_ASIGNACION,
  type EstadoAsignacion,
} from '../../../assignments/domain/entities/asignacion.entity.js';
import {
  ESTADOS_EMERGENCIA,
  type EstadoEmergencia,
} from '../../../emergencies/domain/entities/emergencia.entity.js';
import { LineaGeoJsonDto } from '../../../routing/presentation/dto/ruta_respuesta.dto.js';
import {
  MOTIVOS_SIN_SEGUIMIENTO,
  type MotivoSinSeguimiento,
} from '../../domain/services/seguimiento_ambulancia.js';

/** Cada cuánto conviene que la app vuelva a consultar. */
export const INTERVALO_SUGERIDO_SEGUNDOS = 10;

class UbicacionSeguidaDto {
  @ApiProperty({ example: 7.8939 })
  latitud: number;

  @ApiProperty({ example: -72.5078 })
  longitud: number;

  @ApiProperty({ description: 'Cuándo la reportó el GPS de la ambulancia' })
  registradaEn: Date;

  @ApiProperty({
    description: 'Más de 2 minutos sin reportar: mostrar como aproximada',
  })
  desactualizada: boolean;
}

class LlegadaEstimadaDto {
  @ApiProperty({ example: 2532 })
  distanciaMetros: number;

  @ApiProperty({ example: 229 })
  duracionSegundos: number;

  @ApiProperty({
    description: 'Hora estimada sin tráfico en vivo (mostrar con ≈)',
  })
  llegadaEstimada: Date;

  @ApiProperty({
    type: LineaGeoJsonDto,
    description: 'Camino por calles hasta el lugar del reporte',
  })
  geometria: LineaGeoJsonDto;
}

class AmbulanciaSeguidaDto {
  @ApiPropertyOptional({ type: String, nullable: true, example: 'AMB-01' })
  ambulanciaCodigo: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'TAB' })
  tipoAmbulancia: string | null;

  @ApiProperty({
    enum: ESTADOS_ASIGNACION,
    description:
      'asignada o en_camino: solo se siguen mientras van hacia el lugar',
  })
  etapa: EstadoAsignacion;

  @ApiPropertyOptional({
    type: UbicacionSeguidaDto,
    nullable: true,
    description: 'null si no hay una posición de los últimos 10 minutos',
  })
  ubicacion: UbicacionSeguidaDto | null;

  @ApiPropertyOptional({
    type: LlegadaEstimadaDto,
    nullable: true,
    description:
      'null mientras el backend no ha calculado la ruta (sin GPS reciente)',
  })
  llegada: LlegadaEstimadaDto | null;
}

export class SeguimientoEmergenciaRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  emergenciaId: string;

  @ApiProperty({ example: 'EMG-20261104-0003' })
  numeroEmergencia: string;

  @ApiProperty({ enum: ESTADOS_EMERGENCIA })
  estadoEmergencia: EstadoEmergencia;

  @ApiProperty({
    description: 'false: ocultar el mapa y dejar de consultar si es finalizado',
  })
  disponible: boolean;

  @ApiPropertyOptional({
    enum: MOTIVOS_SIN_SEGUIMIENTO,
    nullable: true,
    description:
      'sin_ambulancia_asignada: la central aún no despacha (seguir consultando) · ambulancia_en_el_lugar: ya llegó (dejar de consultar) · finalizado: la emergencia terminó (dejar de consultar)',
  })
  motivoNoDisponible: MotivoSinSeguimiento | null;

  @ApiProperty({ type: [AmbulanciaSeguidaDto] })
  ambulancias: AmbulanciaSeguidaDto[];

  @ApiProperty()
  consultadoEn: Date;

  @ApiProperty({ example: INTERVALO_SUGERIDO_SEGUNDOS })
  intervaloSugeridoSegundos: number;

  static desde(
    seguimiento: SeguimientoEmergencia,
  ): SeguimientoEmergenciaRespuestaDto {
    return {
      emergenciaId: seguimiento.emergencia.id,
      numeroEmergencia: seguimiento.emergencia.numeroEmergencia,
      estadoEmergencia: seguimiento.emergencia.estado,
      disponible: seguimiento.disponible,
      motivoNoDisponible: seguimiento.motivoNoDisponible,
      ambulancias: seguimiento.ambulancias.map((a) => ({
        ambulanciaCodigo: a.ambulanciaCodigo,
        tipoAmbulancia: a.tipoAmbulancia,
        etapa: a.etapa,
        ubicacion: a.ubicacion,
        llegada: a.llegada
          ? {
              distanciaMetros: a.llegada.distanciaMetros,
              duracionSegundos: a.llegada.duracionSegundos,
              llegadaEstimada: a.llegada.llegadaEstimada,
              geometria: {
                type: 'LineString',
                coordinates: a.llegada.geometria.map((p) => [
                  p.longitud,
                  p.latitud,
                ]),
              },
            }
          : null,
      })),
      consultadoEn: seguimiento.consultadoEn,
      intervaloSugeridoSegundos: INTERVALO_SUGERIDO_SEGUNDOS,
    };
  }
}
