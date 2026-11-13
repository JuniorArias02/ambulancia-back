import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginacionDto } from '../../../../common/dto/paginacion.dto.js';
import type { ResultadoPaginado } from '../../../../common/types/resultado_paginado.js';
import type { Lote } from '../../domain/entities/lote.entity.js';
import { EsFecha, PaginaRespuestaDto } from './validadores.js';

export class ActualizarLoteDto {
  @ApiPropertyOptional({ type: String, nullable: true, example: '2026-01-10' })
  @IsOptional()
  @EsFecha()
  fechaFabricacion?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '2027-01-10',
    description: 'Obligatoria si el insumo requiere vencimiento',
  })
  @IsOptional()
  @EsFecha()
  fechaVencimiento?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  fabricante?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  proveedor?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 500,
    description: 'Factura, remisión o URL',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  documentoSoporte?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  observaciones?: string | null;
}

export class CrearLoteDto extends ActualizarLoteDto {
  @ApiProperty({ format: 'uuid', description: 'Insumo controlado por lote' })
  @IsUUID()
  insumoId: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    format: 'uuid',
    description: 'Obligatorio y vigente si el insumo lo exige',
  })
  @IsOptional()
  @IsUUID()
  registroSanitarioId?: string | null;

  @ApiProperty({ maxLength: 100, example: 'L2026-0457' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  numeroLote: string;

  @ApiPropertyOptional({ type: Date, nullable: true, description: 'ISO 8601' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  recibidoEn?: Date | null;
}

export class ConsultarLotesDto extends PaginacionDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  insumoId?: string;

  @ApiPropertyOptional({ description: 'Número de lote' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  busqueda?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Los que vencen hasta esta fecha',
  })
  @IsOptional()
  @EsFecha()
  vencenHasta?: string;
}

export class LoteRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  insumoId: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  insumoNombre: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' })
  registroSanitarioId: string | null;

  @ApiProperty()
  numeroLote: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  fechaFabricacion: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  fechaVencimiento: string | null;

  @ApiProperty({ description: 'Vencido hoy (hora de Colombia)' })
  vencido: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  fabricante: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  proveedor: string | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  recibidoEn: Date | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  documentoSoporte: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  observaciones: string | null;

  @ApiProperty()
  creadoEn: Date;

  static desde(lote: Lote, hoy: string): LoteRespuestaDto {
    return {
      id: lote.id,
      insumoId: lote.insumoId,
      insumoNombre: lote.insumoNombre,
      registroSanitarioId: lote.registroSanitarioId,
      numeroLote: lote.numeroLote,
      fechaFabricacion: lote.fechaFabricacion,
      fechaVencimiento: lote.fechaVencimiento,
      vencido: lote.estaVencido(hoy),
      fabricante: lote.fabricante,
      proveedor: lote.proveedor,
      recibidoEn: lote.recibidoEn,
      documentoSoporte: lote.documentoSoporte,
      observaciones: lote.observaciones,
      creadoEn: lote.creadoEn,
    };
  }
}

export class LotesPaginadosRespuestaDto extends PaginaRespuestaDto {
  @ApiProperty({ type: [LoteRespuestaDto] })
  datos: LoteRespuestaDto[];

  static desde(
    resultado: ResultadoPaginado<Lote>,
    hoy: string,
  ): LotesPaginadosRespuestaDto {
    return {
      ...resultado,
      datos: resultado.datos.map((l) => LoteRespuestaDto.desde(l, hoy)),
    };
  }
}
