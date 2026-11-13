import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginacionDto } from '../../../../common/dto/paginacion.dto.js';
import type { ResultadoPaginado } from '../../../../common/types/resultado_paginado.js';
import type { Bodega } from '../../domain/entities/bodega.entity.js';
import {
  BooleanoDeConsulta,
  PaginaRespuestaDto,
  SiSeEnvia,
} from './validadores.js';

export class CrearBodegaDto {
  @ApiProperty({ maxLength: 50, example: 'BOD-CENTRAL' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  codigo: string;

  @ApiProperty({ maxLength: 150, example: 'Bodega central' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 250,
    description: 'Dirección o referencia',
  })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  ubicacion?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    format: 'uuid',
    description: 'Personal interno activo',
  })
  @IsOptional()
  @IsUUID()
  responsableId?: string | null;
}

export class ActualizarBodegaDto {
  @ApiPropertyOptional({ maxLength: 50 })
  @SiSeEnvia()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  codigo?: string;

  @ApiPropertyOptional({ maxLength: 150 })
  @SiSeEnvia()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre?: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 250 })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  ubicacion?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    format: 'uuid',
    description: 'null lo quita',
  })
  @IsOptional()
  @IsUUID()
  responsableId?: string | null;
}

export class ConsultarBodegasDto extends PaginacionDto {
  @ApiPropertyOptional({ description: 'Código o nombre' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  busqueda?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @BooleanoDeConsulta()
  activa?: boolean;
}

export class BodegaRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  codigo: string;

  @ApiProperty()
  nombre: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  ubicacion: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' })
  responsableId: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  responsableNombre: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    format: 'uuid',
    description: 'Úsela como origen o destino de los movimientos',
  })
  ubicacionInventarioId: string | null;

  @ApiProperty()
  activa: boolean;

  @ApiProperty()
  creadaEn: Date;

  @ApiProperty()
  actualizadaEn: Date;

  static desde(bodega: Bodega): BodegaRespuestaDto {
    return {
      id: bodega.id,
      codigo: bodega.codigo,
      nombre: bodega.nombre,
      ubicacion: bodega.ubicacion,
      responsableId: bodega.responsableId,
      responsableNombre: bodega.responsableNombre,
      ubicacionInventarioId: bodega.ubicacionInventarioId,
      activa: bodega.activa,
      creadaEn: bodega.creadaEn,
      actualizadaEn: bodega.actualizadaEn,
    };
  }
}

export class BodegasPaginadasRespuestaDto extends PaginaRespuestaDto {
  @ApiProperty({ type: [BodegaRespuestaDto] })
  datos: BodegaRespuestaDto[];

  static desde(
    resultado: ResultadoPaginado<Bodega>,
  ): BodegasPaginadasRespuestaDto {
    return {
      ...resultado,
      datos: resultado.datos.map((b) => BodegaRespuestaDto.desde(b)),
    };
  }
}

/** Lo mínimo que necesita el paramédico para elegir a qué bodega devolver. */
export class BodegaResumenRespuestaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  codigo: string;

  @ApiProperty()
  nombre: string;

  static desde(bodega: Bodega): BodegaResumenRespuestaDto {
    return { id: bodega.id, codigo: bodega.codigo, nombre: bodega.nombre };
  }
}
