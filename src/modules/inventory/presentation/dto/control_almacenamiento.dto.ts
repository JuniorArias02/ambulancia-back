import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginacionDto } from '../../../../common/dto/paginacion.dto.js';
import type { ResultadoPaginado } from '../../../../common/types/resultado_paginado.js';
import {
  type ControlAlmacenamiento,
  RANGO_HUMEDAD,
  RANGO_TEMPERATURA,
} from '../../domain/entities/control_almacenamiento.entity.js';
import { EsFecha, PaginaRespuestaDto } from './validadores.js';

/** Para el paramédico: la ubicación es la de su ambulancia. */
export class LecturaAlmacenamientoDto {
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 4.5,
    description: '°C, -50 a 100',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(RANGO_TEMPERATURA.minimo)
  @Max(RANGO_TEMPERATURA.maximo)
  temperatura?: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 55,
    description: '% de humedad relativa, 0 a 100',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(RANGO_HUMEDAD.minimo)
  @Max(RANGO_HUMEDAD.maximo)
  humedad?: number | null;

  @ApiPropertyOptional({
    type: Date,
    nullable: true,
    description: 'Cuándo se tomó (no futura). Por defecto, ahora',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  registradoEn?: Date | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  observaciones?: string | null;
}

export class RegistrarControlAlmacenamientoDto extends LecturaAlmacenamientoDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  ubicacionId: string;
}

export class ConsultarControlesAlmacenamientoDto extends PaginacionDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  ubicacionId?: string;

  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @EsFecha()
  desde?: string;

  @ApiPropertyOptional({ example: '2026-11-30' })
  @IsOptional()
  @EsFecha()
  hasta?: string;
}

export class ControlAlmacenamientoRespuestaDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) ubicacionId: string;
  @ApiPropertyOptional({ type: String, nullable: true }) ubicacionNombre:
    string | null;
  @ApiProperty({ format: 'uuid' }) usuarioId: string;
  @ApiPropertyOptional({ type: String, nullable: true }) usuarioNombre:
    string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) temperatura:
    number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) humedad: number | null;
  @ApiProperty() registradoEn: Date;
  @ApiPropertyOptional({ type: String, nullable: true }) observaciones:
    string | null;
  @ApiProperty() creadoEn: Date;

  static desde(
    control: ControlAlmacenamiento,
  ): ControlAlmacenamientoRespuestaDto {
    return { ...control };
  }
}

export class ControlesAlmacenamientoPaginadosRespuestaDto extends PaginaRespuestaDto {
  @ApiProperty({ type: [ControlAlmacenamientoRespuestaDto] })
  datos: ControlAlmacenamientoRespuestaDto[];

  static desde(
    resultado: ResultadoPaginado<ControlAlmacenamiento>,
  ): ControlesAlmacenamientoPaginadosRespuestaDto {
    return {
      ...resultado,
      datos: resultado.datos.map((c) =>
        ControlAlmacenamientoRespuestaDto.desde(c),
      ),
    };
  }
}
