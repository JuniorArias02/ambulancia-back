import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PaginacionDto } from '../../../../common/dto/paginacion.dto.js';
import type { ResultadoPaginado } from '../../../../common/types/resultado_paginado.js';
import {
  ESTADOS_EQUIPO,
  type EstadoEquipo,
} from '../../domain/entities/equipo.entity.js';
import {
  ESTADOS_MOVIMIENTO,
  type EstadoMovimiento,
  MAXIMO_LINEAS_MOVIMIENTO,
  type Movimiento,
  TIPOS_MOVIMIENTO,
  type TipoMovimiento,
  type UbicacionMovimiento,
} from '../../domain/entities/movimiento.entity.js';
import {
  TIPOS_UBICACION,
  type TipoUbicacion,
} from '../../domain/entities/ubicacion_inventario.entity.js';
import { EsCantidad, EsFecha, PaginaRespuestaDto } from './validadores.js';

export class LineaMovimientoDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  insumoId: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    format: 'uuid',
    description: 'Obligatorio si el insumo se controla por lote',
  })
  @IsOptional()
  @IsUUID()
  loteId?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    format: 'uuid',
    description: 'Obligatorio si se controla por serie (cantidad 1)',
  })
  @IsOptional()
  @IsUUID()
  equipoId?: string | null;

  @ApiProperty({ example: 2, description: 'Mayor que 0, hasta 3 decimales' })
  @EsCantidad(0.001)
  cantidad: number;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  observaciones?: string | null;
}

class LineasDto {
  @ApiProperty({
    type: [LineaMovimientoDto],
    minItems: 1,
    maxItems: MAXIMO_LINEAS_MOVIMIENTO,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAXIMO_LINEAS_MOVIMIENTO)
  @ValidateNested({ each: true })
  @Type(() => LineaMovimientoDto)
  lineas: LineaMovimientoDto[];
}

/**
 * entrada: solo destino (bodega) · transferencia: origen y destino ·
 * consumo: solo origen (ambulancia) · devolucion: ambulancia → bodega ·
 * ajuste: solo destino (aumenta) o solo origen (disminuye) · baja: solo origen.
 */
export class RegistrarMovimientoDto extends LineasDto {
  @ApiProperty({ enum: TIPOS_MOVIMIENTO })
  @IsIn(TIPOS_MOVIMIENTO)
  tipo: TipoMovimiento;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    format: 'uuid',
    description: 'Ubicación de la que sale',
  })
  @IsOptional()
  @IsUUID()
  origenUbicacionId?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    format: 'uuid',
    description: 'Ubicación a la que llega',
  })
  @IsOptional()
  @IsUUID()
  destinoUbicacionId?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    format: 'uuid',
    description: 'Solo consumo: servicio atendido por la ambulancia de origen',
  })
  @IsOptional()
  @IsUUID()
  asignacionId?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 150,
    description: 'Obligatorio en ajuste y baja',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  motivo?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  observaciones?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 150,
    example: 'Factura FV-1234',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  documentoReferencia?: string | null;

  @ApiPropertyOptional({
    type: Date,
    nullable: true,
    description: 'Cuándo ocurrió (ISO 8601, no futura). Por defecto, ahora',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  realizadoEn?: Date | null;

  @ApiPropertyOptional({
    default: false,
    description: 'true lo confirma de una vez y cambia las existencias',
  })
  @IsOptional()
  @IsBoolean()
  confirmar?: boolean;
}

export class AnularMovimientoDto {
  @ApiProperty({ maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  motivo: string;
}

export class RegistrarConsumoDto extends LineasDto {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    format: 'uuid',
    description: 'Servicio de su turno en el que se usó',
  })
  @IsOptional()
  @IsUUID()
  asignacionId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  observaciones?: string | null;
}

export class RegistrarDevolucionDto extends LineasDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Bodega que recibe (GET /mi-inventario/bodegas)',
  })
  @IsUUID()
  bodegaId: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 150,
    example: 'Sobrante del turno',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  motivo?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  observaciones?: string | null;
}

class FiltrosFechasMovimientoDto extends PaginacionDto {
  @ApiPropertyOptional({ enum: TIPOS_MOVIMIENTO })
  @IsOptional()
  @IsIn(TIPOS_MOVIMIENTO)
  tipo?: TipoMovimiento;

  @ApiPropertyOptional({ enum: ESTADOS_MOVIMIENTO })
  @IsOptional()
  @IsIn(ESTADOS_MOVIMIENTO)
  estado?: EstadoMovimiento;

  @ApiPropertyOptional({
    example: '2026-11-01',
    description: 'AAAA-MM-DD (día de Colombia)',
  })
  @IsOptional()
  @EsFecha()
  desde?: string;

  @ApiPropertyOptional({
    example: '2026-11-30',
    description: 'AAAA-MM-DD (día de Colombia)',
  })
  @IsOptional()
  @EsFecha()
  hasta?: string;
}

export class MisMovimientosDto extends FiltrosFechasMovimientoDto {}

export class ConsultarMovimientosDto extends FiltrosFechasMovimientoDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Como origen o destino' })
  @IsOptional()
  @IsUUID()
  ubicacionId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  insumoId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  asignacionId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Quién lo registró' })
  @IsOptional()
  @IsUUID()
  usuarioId?: string;
}

export class UbicacionMovimientoRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: TIPOS_UBICACION })
  tipo: TipoUbicacion;

  @ApiPropertyOptional({ type: String, nullable: true })
  nombre: string | null;

  static desde(
    ubicacion: UbicacionMovimiento | null,
  ): UbicacionMovimientoRespuestaDto | null {
    return ubicacion
      ? { id: ubicacion.id, tipo: ubicacion.tipo, nombre: ubicacion.nombre }
      : null;
  }
}

export class LineaMovimientoRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  insumoId: string;

  @ApiProperty()
  insumoCodigo: string;

  @ApiProperty()
  insumoNombre: string;

  @ApiProperty()
  unidadMedida: string;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' })
  loteId: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  numeroLote: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  loteVencimiento: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' })
  equipoId: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  numeroSerie: string | null;

  @ApiPropertyOptional({ enum: ESTADOS_EQUIPO, nullable: true })
  equipoEstado: EstadoEquipo | null;

  @ApiProperty()
  cantidad: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  observaciones: string | null;
}

export class MovimientoRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'MOV-20261111-1A2B3C4D' })
  codigo: string;

  @ApiProperty({ enum: TIPOS_MOVIMIENTO })
  tipo: TipoMovimiento;

  @ApiProperty({ enum: ESTADOS_MOVIMIENTO })
  estado: EstadoMovimiento;

  @ApiPropertyOptional({
    type: UbicacionMovimientoRespuestaDto,
    nullable: true,
  })
  origen: UbicacionMovimientoRespuestaDto | null;

  @ApiPropertyOptional({
    type: UbicacionMovimientoRespuestaDto,
    nullable: true,
  })
  destino: UbicacionMovimientoRespuestaDto | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' })
  asignacionId: string | null;

  @ApiProperty({ format: 'uuid' })
  usuarioId: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  usuarioNombre: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  motivo: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  observaciones: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  documentoReferencia: string | null;

  @ApiProperty()
  realizadoEn: Date;

  @ApiProperty()
  creadoEn: Date;

  @ApiProperty()
  actualizadoEn: Date;

  @ApiProperty({ type: [LineaMovimientoRespuestaDto] })
  lineas: LineaMovimientoRespuestaDto[];

  static desde(movimiento: Movimiento): MovimientoRespuestaDto {
    return {
      id: movimiento.id,
      codigo: movimiento.codigo,
      tipo: movimiento.tipo,
      estado: movimiento.estado,
      origen: UbicacionMovimientoRespuestaDto.desde(movimiento.origen),
      destino: UbicacionMovimientoRespuestaDto.desde(movimiento.destino),
      asignacionId: movimiento.asignacionId,
      usuarioId: movimiento.usuarioId,
      usuarioNombre: movimiento.usuarioNombre,
      motivo: movimiento.motivo,
      observaciones: movimiento.observaciones,
      documentoReferencia: movimiento.documentoReferencia,
      realizadoEn: movimiento.realizadoEn,
      creadoEn: movimiento.creadoEn,
      actualizadoEn: movimiento.actualizadoEn,
      lineas: movimiento.lineas.map((l) => ({
        id: l.id,
        insumoId: l.insumoId,
        insumoCodigo: l.insumoCodigo,
        insumoNombre: l.insumoNombre,
        unidadMedida: l.unidadMedida,
        loteId: l.loteId,
        numeroLote: l.numeroLote,
        loteVencimiento: l.loteVencimiento,
        equipoId: l.equipoId,
        numeroSerie: l.numeroSerie,
        equipoEstado: l.equipoEstado,
        cantidad: l.cantidad,
        observaciones: l.observaciones,
      })),
    };
  }
}

export class MovimientosPaginadosRespuestaDto extends PaginaRespuestaDto {
  @ApiProperty({ type: [MovimientoRespuestaDto] })
  datos: MovimientoRespuestaDto[];

  static desde(
    resultado: ResultadoPaginado<Movimiento>,
  ): MovimientosPaginadosRespuestaDto {
    return {
      ...resultado,
      datos: resultado.datos.map((m) => MovimientoRespuestaDto.desde(m)),
    };
  }
}
